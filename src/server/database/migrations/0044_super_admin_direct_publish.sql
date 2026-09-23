-- One explicit workflow state records a Super Admin's exceptional self-publication.
-- Existing Admin review and publication rows remain standard and unchanged.
ALTER TABLE juyu.documents ADD COLUMN approval_mode text NOT NULL DEFAULT 'standard'
 CHECK(approval_mode IN('standard','super_admin'));

DO $$
DECLARE constraint_name text;
BEGIN
 SELECT c.conname INTO constraint_name FROM pg_constraint c
 WHERE c.conrelid='juyu.documents'::regclass AND c.contype='c'
  AND pg_get_constraintdef(c.oid) LIKE '%workflow_state%submitted_by%reviewer_id%approved_by%'
 LIMIT 1;
 IF constraint_name IS NULL THEN RAISE EXCEPTION 'DOCUMENT_WORKFLOW_CONSTRAINT_NOT_FOUND';END IF;
 EXECUTE format('ALTER TABLE juyu.documents DROP CONSTRAINT %I',constraint_name);
END $$;
ALTER TABLE juyu.documents ADD CONSTRAINT documents_workflow_integrity_check CHECK(
 (approval_mode='standard' AND (
  (workflow_state='draft' AND submitted_by IS NULL AND reviewer_id IS NULL AND approved_by IS NULL)
  OR (workflow_state IN('in_review','changes_requested') AND submitted_by IS NOT NULL AND reviewer_id IS NOT NULL AND submitted_by<>reviewer_id AND approved_by IS NULL)
  OR (workflow_state IN('approved','queued','published') AND submitted_by IS NOT NULL AND reviewer_id IS NOT NULL AND submitted_by<>reviewer_id AND approved_by IS NOT NULL AND approved_by=reviewer_id)
 ))
 OR (approval_mode='super_admin' AND workflow_state='published' AND submitted_by IS NOT NULL
  AND submitted_by=reviewer_id AND submitted_by=approved_by)
);

ALTER TABLE juyu.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE juyu.audit_log ADD CONSTRAINT audit_log_action_check CHECK(action IN(
 'create','edit','submit','withdraw','reassign','reject','approve','queue','publish','direct_publish','trash','restore',
 'archive','unpublish','unarchive','restore_version','discard_draft'
));
ALTER TABLE juyu.audit_log ADD CONSTRAINT audit_direct_publish_check CHECK(
 action<>'direct_publish' OR (reason IS NULL AND reviewer_id=actor_id)
);

CREATE OR REPLACE FUNCTION juyu.check_document_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d juyu.documents; r juyu.revisions; expected_review text;
BEGIN
 SELECT * INTO d FROM juyu.documents WHERE id=NEW.id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO r FROM juyu.revisions WHERE document_id=d.id AND revision_id=d.workflow_revision_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'INTEGRITY: missing working revision'; END IF;
 IF d.kind='ops' AND EXISTS(SELECT 1 FROM juyu.revisions WHERE document_id=d.id AND audience='staff') THEN
  RAISE EXCEPTION 'INTEGRITY: OPS cannot be staff content';
 END IF;
 IF d.approval_mode='standard' AND d.reviewer_id IN(r.author_id,r.editor_id) THEN RAISE EXCEPTION 'INTEGRITY: self review';END IF;
 expected_review:=CASE d.workflow_state WHEN 'in_review' THEN 'in_review' WHEN 'changes_requested' THEN 'rejected'
  WHEN 'approved' THEN 'approved' WHEN 'queued' THEN 'approved' WHEN 'published' THEN 'approved' ELSE NULL END;
 IF d.approval_mode='standard' AND expected_review IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM juyu.reviews WHERE document_id=d.id AND revision_id=d.workflow_revision_id
   AND status=expected_review AND submitted_by=d.submitted_by AND reviewer_id=d.reviewer_id
 ) THEN RAISE EXCEPTION 'INTEGRITY: missing matching review';END IF;
 IF d.approval_mode='super_admin' AND NOT EXISTS(
  SELECT 1 FROM juyu.audit_log a JOIN juyu.members m ON m.clerk_user_id=a.actor_id
  WHERE a.document_id=d.id AND a.revision_id=d.workflow_revision_id
   AND a.action='direct_publish' AND a.actor_id=d.submitted_by
   AND a.actor_id=d.reviewer_id AND a.actor_id=d.approved_by
   AND m.observed_role='super_admin'
 ) THEN RAISE EXCEPTION 'INTEGRITY: missing super admin publication evidence';END IF;
 IF d.published_revision_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM juyu.audit_log WHERE document_id=d.id AND revision_id=d.published_revision_id AND action IN('publish','direct_publish')
 ) THEN RAISE EXCEPTION 'INTEGRITY: missing publication event';END IF;
 IF (SELECT count(*) FROM juyu.audit_log WHERE document_id=d.id)<>d.sequence+1
  OR NOT EXISTS(SELECT 1 FROM juyu.audit_log WHERE document_id=d.id AND sequence=d.sequence AND revision_id=d.workflow_revision_id)
 THEN RAISE EXCEPTION 'INTEGRITY: missing audit sequence';END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION juyu.publication_number(p_document text) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE published integer;first_sequence integer;result integer;
BEGIN
 SELECT published_revision_id INTO published FROM juyu.documents WHERE id=p_document;
 IF published IS NULL OR NOT coalesce(juyu.can_read_revision(p_document,published),false) THEN RETURN NULL;END IF;
 SELECT min(sequence) INTO first_sequence FROM juyu.audit_log WHERE document_id=p_document AND action IN('publish','direct_publish') AND revision_id=published;
 IF first_sequence IS NULL THEN RETURN NULL;END IF;
 SELECT count(DISTINCT revision_id)::integer INTO result FROM juyu.audit_log WHERE document_id=p_document AND action IN('publish','direct_publish') AND sequence<=first_sequence;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION juyu.read_publication_timestamp(document text) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT max(a.at) FROM juyu.documents d
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 JOIN juyu.audit_log a ON a.document_id=d.id AND a.revision_id=r.revision_id AND a.action IN('publish','direct_publish')
 WHERE d.id=document AND juyu.can_read_revision(r.document_id,r.revision_id)
$$;

DROP INDEX juyu.audit_publication_feed;
CREATE INDEX audit_publication_feed ON juyu.audit_log(at DESC,document_id,revision_id) WHERE action IN('publish','direct_publish');

CREATE OR REPLACE FUNCTION juyu.read_changelog(p_page integer)
RETURNS TABLE(id text,kind text,title text,published_at timestamptz,publication_number integer,release_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.id,d.kind,r.title,max(a.at),juyu.publication_number(d.id),r.release_note
 FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 JOIN juyu.audit_log a ON a.document_id=d.id AND a.revision_id=r.revision_id AND a.action IN('publish','direct_publish')
 WHERE p_page BETWEEN 1 AND 100 AND juyu.can_read_revision(d.id,r.revision_id)
 GROUP BY d.id,d.kind,r.title,r.release_note ORDER BY max(a.at) DESC,d.id COLLATE "C"
 LIMIT 21 OFFSET (p_page-1)*20
$$;

CREATE OR REPLACE FUNCTION juyu.read_changelog_locale(p_page integer,p_locale text)
RETURNS TABLE(id text,kind text,title text,published_at timestamptz,publication_number integer,release_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.id,d.kind,r.title,max(a.at),juyu.publication_number(d.id),r.release_note
 FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 JOIN juyu.audit_log a ON a.document_id=d.id AND a.revision_id=r.revision_id AND a.action IN('publish','direct_publish')
 WHERE p_page BETWEEN 1 AND 100 AND p_locale IN('zh-CN','en') AND d.locale=p_locale AND juyu.can_read_revision(d.id,r.revision_id)
 GROUP BY d.id,d.kind,r.title,r.release_note ORDER BY max(a.at) DESC,d.id COLLATE "C"
 LIMIT 21 OFFSET (p_page-1)*20
$$;

-- Older SECURITY DEFINER commands reset or restore workflow state directly.
-- Extend their definitions so approval_mode always follows the restored state.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('juyu.change_document_lifecycle(text,text,integer,text)'::regprocedure) INTO definition;
 IF position('workflow_state=''draft'',published_revision_id=NULL' IN definition)=0 THEN RAISE EXCEPTION 'LIFECYCLE_DEFINITION_CHANGED';END IF;
 EXECUTE replace(definition,'workflow_state=''draft'',published_revision_id=NULL','workflow_state=''draft'',approval_mode=''standard'',published_revision_id=NULL');

 SELECT pg_get_functiondef('juyu.change_document_availability(text,text,integer)'::regprocedure) INTO definition;
 IF position('workflow_state=''draft'',published_revision_id=NULL' IN definition)=0 THEN RAISE EXCEPTION 'AVAILABILITY_DEFINITION_CHANGED';END IF;
 EXECUTE replace(definition,'workflow_state=''draft'',published_revision_id=NULL','workflow_state=''draft'',approval_mode=''standard'',published_revision_id=NULL');

 SELECT pg_get_functiondef('juyu.restore_document_version(text,integer,integer)'::regprocedure) INTO definition;
 IF position('workflow_state=''draft'',submitted_by=NULL' IN definition)=0 THEN RAISE EXCEPTION 'RESTORE_DEFINITION_CHANGED';END IF;
 EXECUTE replace(definition,'workflow_state=''draft'',submitted_by=NULL','workflow_state=''draft'',approval_mode=''standard'',submitted_by=NULL');

 SELECT pg_get_functiondef('juyu.discard_working_draft(text,integer)'::regprocedure) INTO definition;
 IF position('workflow_state=''published'',' IN definition)=0 THEN RAISE EXCEPTION 'DISCARD_DEFINITION_CHANGED';END IF;
 EXECUTE replace(definition,'workflow_state=''published'',','workflow_state=''published'',approval_mode=CASE WHEN EXISTS(SELECT 1 FROM juyu.audit_log pa WHERE pa.document_id=p_document AND pa.revision_id=d.published_revision_id AND pa.action=''direct_publish'') THEN ''super_admin'' ELSE ''standard'' END,');
END $$;
