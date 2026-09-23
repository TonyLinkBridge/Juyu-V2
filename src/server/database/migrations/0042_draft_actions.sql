-- Keep discarded working revisions in immutable history while the published revision stays live.
ALTER TABLE juyu.audit_log ADD COLUMN discarded_revision_id integer;
ALTER TABLE juyu.audit_log ADD CONSTRAINT audit_discarded_revision_fk
 FOREIGN KEY(document_id,discarded_revision_id) REFERENCES juyu.revisions(document_id,revision_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE juyu.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE juyu.audit_log ADD CONSTRAINT audit_log_action_check CHECK(action IN(
 'create','edit','submit','withdraw','reassign','reject','approve','queue','publish','trash','restore',
 'archive','unpublish','unarchive','restore_version','discard_draft'
));
ALTER TABLE juyu.audit_log ADD CONSTRAINT audit_discarded_revision_check CHECK(
 (action='discard_draft')=(discarded_revision_id IS NOT NULL)
 AND (discarded_revision_id IS NULL OR discarded_revision_id>revision_id)
);

CREATE FUNCTION juyu.discard_working_draft(p_document text,p_expected integer)
RETURNS TABLE(document_id text,sequence integer,revision integer,published_revision integer,status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE d juyu.documents;published_review juyu.reviews;who text;stamp timestamptz;
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
 SELECT * INTO published_review FROM juyu.reviews r WHERE r.document_id=p_document AND r.revision_id=d.published_revision_id AND r.status='approved' ORDER BY r.submitted_sequence DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 stamp:=clock_timestamp();
 UPDATE juyu.documents SET sequence=d.sequence+1,workflow_revision_id=d.published_revision_id,workflow_state='published',
  submitted_by=published_review.submitted_by,reviewer_id=published_review.reviewer_id,approved_by=published_review.reviewer_id,updated_at=stamp WHERE id=p_document;
 INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,discarded_revision_id,at)
  VALUES(p_document,d.sequence+1,'discard_draft',who,d.published_revision_id,d.workflow_revision_id,stamp);
 RETURN QUERY SELECT p_document,d.sequence+1,d.published_revision_id,d.published_revision_id,'published'::text;
END $$;
REVOKE ALL ON FUNCTION juyu.discard_working_draft(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.discard_working_draft(text,integer) TO juyu_runtime;
