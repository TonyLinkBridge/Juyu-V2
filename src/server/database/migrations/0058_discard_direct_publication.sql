-- Fix discard for both publication paths without changing stored content or review rules.
CREATE OR REPLACE FUNCTION juyu.discard_working_draft(p_document text,p_expected integer)
RETURNS TABLE(document_id text,sequence integer,revision integer,published_revision integer,status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE d juyu.documents;published_review juyu.reviews;publication juyu.audit_log;restored_submitter text;restored_reviewer text;restored_mode text;who text;stamp timestamptz;
BEGIN
 IF p_document IS NULL OR btrim(p_document)='' OR p_document<>btrim(p_document) OR char_length(p_document)>200 OR p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY'; END IF;
 who:=juyu.actor_id();
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('editor:'||p_document,0));
 SELECT * INTO d FROM juyu.documents WHERE id=p_document FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who ORDER BY clerk_user_id FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF d.sequence=p_expected+1 AND d.lifecycle='active' AND d.workflow_state='published'
  AND d.workflow_revision_id=d.published_revision_id
  AND (SELECT a.sequence=d.sequence AND a.action='discard_draft' AND a.actor_id=who AND a.revision_id=d.published_revision_id AND a.discarded_revision_id>d.published_revision_id FROM juyu.audit_log a WHERE a.document_id=p_document ORDER BY a.sequence DESC LIMIT 1) THEN
  RETURN QUERY SELECT p_document,d.sequence,d.workflow_revision_id,d.published_revision_id,'published'::text;RETURN;
 END IF;
 IF d.sequence<>p_expected THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF d.lifecycle<>'active' OR d.workflow_state<>'draft' OR d.published_revision_id IS NULL OR d.workflow_revision_id=d.published_revision_id
  OR EXISTS(SELECT 1 FROM juyu.reviews r WHERE r.document_id=p_document AND r.status='in_review') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 IF EXISTS(SELECT 1 FROM juyu.assets a WHERE a.document_id=p_document AND a.status='pending') THEN RAISE EXCEPTION 'UPLOAD_IN_PROGRESS'; END IF;
 -- Restore provenance of the formal revision, never the actor discarding the draft.
 -- Direct publication deliberately has no fabricated two-person review record.
 SELECT * INTO publication FROM juyu.audit_log a
  WHERE a.document_id=p_document AND a.revision_id=d.published_revision_id
   AND a.action IN('publish','direct_publish') ORDER BY a.sequence DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 IF publication.action='direct_publish' THEN
  restored_mode:='super_admin';
  restored_submitter:=publication.actor_id;
  restored_reviewer:=publication.actor_id;
 ELSE
  SELECT * INTO published_review FROM juyu.reviews r
   WHERE r.document_id=p_document AND r.revision_id=d.published_revision_id AND r.status='approved'
   ORDER BY r.submitted_sequence DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  restored_mode:='standard';
  restored_submitter:=published_review.submitted_by;
  restored_reviewer:=published_review.reviewer_id;
 END IF;
 stamp:=clock_timestamp();
 UPDATE juyu.documents SET sequence=d.sequence+1,workflow_revision_id=d.published_revision_id,workflow_state='published',approval_mode=restored_mode,
  submitted_by=restored_submitter,reviewer_id=restored_reviewer,approved_by=restored_reviewer,updated_at=stamp WHERE id=p_document;
 INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,discarded_revision_id,at)
  VALUES(p_document,d.sequence+1,'discard_draft',who,d.published_revision_id,d.workflow_revision_id,stamp);
 RETURN QUERY SELECT p_document,d.sequence+1,d.published_revision_id,d.published_revision_id,'published'::text;
END $$;
REVOKE ALL ON FUNCTION juyu.discard_working_draft(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.discard_working_draft(text,integer) TO juyu_runtime;

-- Validate privilege when immutable publication evidence is created, not against
-- the publisher's later role when restoring an already published revision.
-- The existing audit RLS actor binding and publication command checks still apply.
CREATE FUNCTION juyu.validate_direct_publication_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE publisher_role text;
BEGIN
 IF NEW.action='direct_publish' THEN
  SELECT observed_role INTO publisher_role FROM juyu.members
   WHERE clerk_user_id=NEW.actor_id FOR SHARE;
  IF publisher_role IS DISTINCT FROM 'super_admin' THEN
   RAISE EXCEPTION 'INTEGRITY: missing super admin publication evidence';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION juyu.validate_direct_publication_evidence() FROM PUBLIC;
CREATE TRIGGER validate_direct_publication_evidence BEFORE INSERT ON juyu.audit_log
 FOR EACH ROW EXECUTE FUNCTION juyu.validate_direct_publication_evidence();

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
  SELECT 1 FROM juyu.audit_log a
  WHERE a.document_id=d.id AND a.revision_id=d.workflow_revision_id
   AND a.action='direct_publish' AND a.actor_id=d.submitted_by
   AND a.actor_id=d.reviewer_id AND a.actor_id=d.approved_by
   AND r.editor_id=a.actor_id
 ) THEN RAISE EXCEPTION 'INTEGRITY: missing super admin publication evidence';END IF;
 IF d.published_revision_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM juyu.audit_log WHERE document_id=d.id AND revision_id=d.published_revision_id AND action IN('publish','direct_publish')
 ) THEN RAISE EXCEPTION 'INTEGRITY: missing publication event';END IF;
 IF (SELECT count(*) FROM juyu.audit_log WHERE document_id=d.id)<>d.sequence+1
  OR NOT EXISTS(SELECT 1 FROM juyu.audit_log WHERE document_id=d.id AND sequence=d.sequence AND revision_id=d.workflow_revision_id)
 THEN RAISE EXCEPTION 'INTEGRITY: missing audit sequence';END IF;
 RETURN NULL;
END $$;

