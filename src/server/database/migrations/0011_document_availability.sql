-- Add availability evidence without modifying any prior migration or historical row.
ALTER TABLE juyu.audit_log ADD COLUMN previous_published_revision_id integer;
ALTER TABLE juyu.audit_log ADD CONSTRAINT audit_previous_publication_fk FOREIGN KEY(document_id,previous_published_revision_id) REFERENCES juyu.revisions(document_id,revision_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE juyu.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE juyu.audit_log ADD CONSTRAINT audit_log_action_check CHECK(action IN('create','edit','submit','withdraw','reassign','reject','approve','queue','publish','trash','restore','archive','unpublish','unarchive'));
CREATE OR REPLACE FUNCTION juyu.guard_lifecycle_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.lifecycle<>'active' AND NOT pg_has_role(session_user,(SELECT relowner FROM pg_class WHERE oid='juyu.documents'::regclass),'MEMBER') THEN RAISE EXCEPTION 'LIFECYCLE_COMMAND_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('editor:'||NEW.id,0));
  IF EXISTS(SELECT 1 FROM juyu.deletion_receipts WHERE document_id=NEW.id) THEN RAISE EXCEPTION 'PURGED_ID'; END IF;
 ELSIF OLD.lifecycle IS DISTINCT FROM NEW.lifecycle
  AND NOT pg_has_role(session_user,(SELECT relowner FROM pg_class WHERE oid='juyu.documents'::regclass),'MEMBER')
  AND NOT EXISTS(SELECT 1 FROM juyu.lifecycle_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND document_id=OLD.id
   AND ((action='trash' AND OLD.lifecycle IN('active','archived') AND NEW.lifecycle='trashed')
    OR (action='restore' AND OLD.lifecycle='trashed' AND NEW.lifecycle='active')
    OR (action='archive' AND OLD.lifecycle='active' AND NEW.lifecycle='archived')
    OR (action='unarchive' AND OLD.lifecycle='archived' AND NEW.lifecycle='active'))) THEN
  RAISE EXCEPTION 'LIFECYCLE_COMMAND_REQUIRED';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION juyu.change_document_availability(p_document text,p_action text,p_expected integer)
RETURNS TABLE(document_id text,sequence integer,revision integer,action text,lifecycle text,status text,published_revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE d juyu.documents;who text;target_lifecycle text;stamp timestamptz;
BEGIN
 IF p_document IS NULL OR btrim(p_document)='' OR char_length(p_document)>200 OR p_action IS NULL OR p_action NOT IN('archive','unpublish','unarchive') OR p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY'; END IF;
 who:=juyu.actor_id();
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('editor:'||p_document,0));
 SELECT * INTO d FROM juyu.documents WHERE id=p_document FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 -- Same document/member lock order as review and publication commands.
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who ORDER BY clerk_user_id FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 target_lifecycle:=CASE WHEN p_action='archive' THEN 'archived' ELSE 'active' END;
 IF d.sequence=p_expected+1 AND d.lifecycle=target_lifecycle AND d.workflow_state='draft'
  AND d.published_revision_id IS NULL AND d.submitted_by IS NULL AND d.reviewer_id IS NULL AND d.approved_by IS NULL
  AND NOT EXISTS(SELECT 1 FROM juyu.reviews r WHERE r.document_id=p_document AND r.status='in_review')
  AND (SELECT a.sequence=d.sequence AND a.action=p_action AND a.actor_id=who AND a.revision_id=d.workflow_revision_id FROM juyu.audit_log a WHERE a.document_id=p_document ORDER BY a.sequence DESC LIMIT 1) THEN
  RETURN QUERY SELECT p_document,d.sequence,d.workflow_revision_id,p_action,target_lifecycle,'draft'::text,NULL::integer;RETURN;
 END IF;
 IF d.sequence<>p_expected THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF (p_action IN('archive','unpublish') AND d.lifecycle<>'active') OR (p_action='unarchive' AND d.lifecycle<>'archived') OR (p_action='unpublish' AND d.published_revision_id IS NULL) THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 -- Reserve-upload locks this document FOR SHARE; no unfinished upload can enter
 -- between this check and commit. Restoring a draft needs no ready-file check.
 IF p_action IN('archive','unpublish') AND EXISTS(SELECT 1 FROM juyu.assets a WHERE a.document_id=p_document AND a.status='pending') THEN RAISE EXCEPTION 'UPLOAD_IN_PROGRESS'; END IF;
 stamp:=clock_timestamp();
 INSERT INTO juyu.lifecycle_contexts VALUES(pg_backend_pid(),txid_current(),p_document,p_action);
 UPDATE juyu.reviews SET status='withdrawn',decided_by=who,decided_at=stamp WHERE reviews.document_id=p_document AND reviews.status='in_review';
 UPDATE juyu.documents SET lifecycle=target_lifecycle,sequence=d.sequence+1,workflow_state='draft',published_revision_id=NULL,submitted_by=NULL,reviewer_id=NULL,approved_by=NULL,updated_at=stamp WHERE id=p_document;
 INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,previous_published_revision_id,at)
 VALUES(p_document,d.sequence+1,p_action,who,d.workflow_revision_id,d.published_revision_id,stamp);
 DELETE FROM juyu.lifecycle_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND lifecycle_contexts.document_id=p_document;
 RETURN QUERY SELECT p_document,d.sequence+1,d.workflow_revision_id,p_action,target_lifecycle,'draft'::text,NULL::integer;
END $$;
REVOKE ALL ON FUNCTION juyu.guard_lifecycle_write(),juyu.change_document_availability(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.change_document_availability(text,text,integer) TO juyu_runtime;
