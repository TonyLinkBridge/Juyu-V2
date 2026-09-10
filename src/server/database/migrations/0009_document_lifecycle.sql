-- Independent immutable deletion receipt: historical metadata only, never revision bodies.
CREATE TABLE juyu.deletion_receipts (
 document_id text PRIMARY KEY,title text NOT NULL,actor_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
 expected_sequence integer NOT NULL,sequence integer NOT NULL CHECK(sequence=expected_sequence+1),deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 audit jsonb NOT NULL,reviews jsonb NOT NULL,upload_events jsonb NOT NULL
);
CREATE TABLE juyu.storage_cleanup_jobs (
 id uuid PRIMARY KEY,document_id text NOT NULL REFERENCES juyu.deletion_receipts(document_id),
 bucket text NOT NULL CHECK(bucket='juyu-private'),object_key text NOT NULL CHECK(object_key=id::text),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),last_attempt_at timestamptz,completed_at timestamptz,completed_by text REFERENCES juyu.members(clerk_user_id),
 CHECK((completed_at IS NULL)=(completed_by IS NULL))
);
CREATE INDEX cleanup_pending_document ON juyu.storage_cleanup_jobs(document_id,last_attempt_at NULLS FIRST,id) WHERE completed_at IS NULL;
-- Only SECURITY DEFINER lifecycle commands can create this transaction-scoped capability.
CREATE TABLE juyu.lifecycle_contexts(backend_pid integer,transaction_id bigint,document_id text,action text NOT NULL,PRIMARY KEY(backend_pid,transaction_id,document_id));
ALTER TABLE juyu.deletion_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.storage_cleanup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.lifecycle_contexts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.deletion_receipts,juyu.storage_cleanup_jobs,juyu.lifecycle_contexts FROM PUBLIC,juyu_runtime,juyu_context_issuer;
GRANT SELECT ON juyu.deletion_receipts,juyu.storage_cleanup_jobs TO juyu_runtime;
CREATE POLICY deletion_receipts_admin ON juyu.deletion_receipts FOR SELECT TO juyu_runtime USING(juyu.is_admin());
CREATE POLICY cleanup_jobs_admin ON juyu.storage_cleanup_jobs FOR SELECT TO juyu_runtime USING(juyu.is_admin());
CREATE TRIGGER immutable_deletion_receipt BEFORE UPDATE OR DELETE ON juyu.deletion_receipts FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();
ALTER TABLE juyu.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE juyu.audit_log ADD CONSTRAINT audit_log_action_check CHECK(action IN('create','edit','submit','withdraw','reassign','reject','approve','queue','publish','trash','restore'));
CREATE FUNCTION juyu.guard_lifecycle_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('editor:'||NEW.id,0));
  IF EXISTS(SELECT 1 FROM juyu.deletion_receipts WHERE document_id=NEW.id) THEN RAISE EXCEPTION 'PURGED_ID'; END IF;
 ELSIF OLD.lifecycle IS DISTINCT FROM NEW.lifecycle
  -- Migration owners retain operator control; ScopedDatabase forbids these credentials.
  AND NOT pg_has_role(session_user,(SELECT relowner FROM pg_class WHERE oid='juyu.documents'::regclass),'MEMBER') AND NOT EXISTS(SELECT 1 FROM juyu.lifecycle_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND document_id=OLD.id AND action IN('trash','restore')) THEN
  RAISE EXCEPTION 'LIFECYCLE_COMMAND_REQUIRED';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_write BEFORE INSERT OR UPDATE ON juyu.documents FOR EACH ROW EXECUTE FUNCTION juyu.guard_lifecycle_write();
CREATE FUNCTION juyu.guard_purge_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE target text;
BEGIN
 IF TG_TABLE_NAME='upload_events' THEN SELECT document_id INTO target FROM juyu.assets WHERE id=OLD.asset_id;
 ELSE target:=OLD.document_id; END IF;
 IF NOT EXISTS(SELECT 1 FROM juyu.lifecycle_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND document_id=target AND action='purge') THEN RAISE EXCEPTION 'IMMUTABLE: deletion requires scoped purge'; END IF;
 RETURN OLD;
END $$;
-- Keep UPDATE protection unchanged; only DELETE gets the narrowly scoped purge check.
DROP TRIGGER immutable_revision ON juyu.revisions;
CREATE TRIGGER immutable_revision BEFORE UPDATE ON juyu.revisions FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();
CREATE TRIGGER purge_revision BEFORE DELETE ON juyu.revisions FOR EACH ROW EXECUTE FUNCTION juyu.guard_purge_delete();
DROP TRIGGER immutable_audit ON juyu.audit_log;
CREATE TRIGGER immutable_audit BEFORE UPDATE ON juyu.audit_log FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();
CREATE TRIGGER purge_audit BEFORE DELETE ON juyu.audit_log FOR EACH ROW EXECUTE FUNCTION juyu.guard_purge_delete();
DROP TRIGGER preserve_review_history ON juyu.reviews;
CREATE TRIGGER preserve_review_history BEFORE UPDATE ON juyu.reviews FOR EACH ROW EXECUTE FUNCTION juyu.protect_review_history();
CREATE TRIGGER purge_review BEFORE DELETE ON juyu.reviews FOR EACH ROW EXECUTE FUNCTION juyu.guard_purge_delete();
DROP TRIGGER upload_events_immutable ON juyu.upload_events;
CREATE TRIGGER upload_events_immutable BEFORE UPDATE ON juyu.upload_events FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();
CREATE TRIGGER purge_upload_event BEFORE DELETE ON juyu.upload_events FOR EACH ROW EXECUTE FUNCTION juyu.guard_purge_delete();
CREATE FUNCTION juyu.change_document_lifecycle(p_document text,p_action text,p_expected integer,p_confirmation text DEFAULT NULL)
RETURNS TABLE(document_id text,action text,sequence integer,cleanup_pending integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE d juyu.documents;receipt juyu.deletion_receipts;who text;current_title text;pending integer;asset_key uuid;
BEGIN
 IF NOT juyu.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 who:=juyu.actor_id();
 -- Prevent role/disable changes from racing an already verified destructive action.
 PERFORM 1 FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_document IS NULL OR btrim(p_document)='' OR char_length(p_document)>200 OR p_action IS NULL OR p_action NOT IN('trash','restore','purge') OR p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('editor:'||p_document,0));
 SELECT * INTO d FROM juyu.documents WHERE id=p_document FOR UPDATE;
 IF NOT FOUND THEN
  SELECT * INTO receipt FROM juyu.deletion_receipts r WHERE r.document_id=p_document AND r.actor_id=who AND r.expected_sequence=p_expected AND r.title=p_confirmation AND p_action='purge';
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT count(*)::int INTO pending FROM juyu.storage_cleanup_jobs j WHERE j.document_id=p_document AND j.completed_at IS NULL;
  RETURN QUERY SELECT p_document,p_action,receipt.sequence,pending;RETURN;
 END IF;
 IF d.sequence<>p_expected THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF (p_action='trash' AND d.lifecycle NOT IN('active','archived')) OR (p_action IN('restore','purge') AND d.lifecycle<>'trashed') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 -- reserve_upload holds FOR SHARE on this same document until its reservation commits.
 IF p_action IN('trash','purge') AND EXISTS(SELECT 1 FROM juyu.assets a WHERE a.document_id=p_document AND a.status='pending') THEN RAISE EXCEPTION 'UPLOAD_IN_PROGRESS'; END IF;
 SELECT title INTO current_title FROM juyu.revisions WHERE revisions.document_id=p_document AND revision_id=d.workflow_revision_id;
 IF p_action='purge' AND (p_confirmation IS NULL OR p_confirmation<>current_title) THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED'; END IF;
 INSERT INTO juyu.lifecycle_contexts VALUES(pg_backend_pid(),txid_current(),p_document,p_action);
 IF p_action IN('trash','restore') THEN
  UPDATE juyu.reviews SET status='withdrawn',decided_by=who,decided_at=clock_timestamp() WHERE reviews.document_id=p_document AND status='in_review';
  UPDATE juyu.documents SET lifecycle=CASE WHEN p_action='trash' THEN 'trashed' ELSE 'active' END,
   sequence=d.sequence+1,workflow_state='draft',published_revision_id=NULL,submitted_by=NULL,reviewer_id=NULL,approved_by=NULL,updated_at=clock_timestamp() WHERE id=p_document;
  INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,at) VALUES(p_document,d.sequence+1,p_action,who,d.workflow_revision_id,clock_timestamp());
  pending:=0;
 ELSE
  -- Share object-identity locks with INSERT. Sorted acquisition avoids lock-order cycles.
  FOR asset_key IN SELECT a.id FROM juyu.assets a WHERE a.document_id=p_document ORDER BY a.id LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('asset:'||asset_key::text,0));
  END LOOP;
  INSERT INTO juyu.deletion_receipts(document_id,title,actor_id,expected_sequence,sequence,audit,reviews,upload_events)
  VALUES(p_document,current_title,who,d.sequence,d.sequence+1,
   (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.sequence),'[]') FROM juyu.audit_log a WHERE a.document_id=p_document),
   (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.submitted_sequence),'[]') FROM juyu.reviews r WHERE r.document_id=p_document),
   (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM juyu.upload_events e JOIN juyu.assets a ON a.id=e.asset_id WHERE a.document_id=p_document));
  INSERT INTO juyu.storage_cleanup_jobs(id,document_id,bucket,object_key) SELECT a.id,a.document_id,a.bucket,a.object_key FROM juyu.assets a WHERE a.document_id=p_document;
  GET DIAGNOSTICS pending=ROW_COUNT;
  DELETE FROM juyu.notification_receipts WHERE notification_id IN(SELECT n.id FROM juyu.notifications n WHERE target_document_id=p_document);
  DELETE FROM juyu.notifications WHERE target_document_id=p_document;
  DELETE FROM juyu.analytics_events WHERE analytics_events.document_id=p_document;
  DELETE FROM juyu.search_results WHERE search_results.document_id=p_document;
  DELETE FROM juyu.feedback WHERE feedback.document_id=p_document;
  DELETE FROM juyu.recent_views WHERE recent_views.document_id=p_document;
  DELETE FROM juyu.favorites WHERE favorites.document_id=p_document;
  DELETE FROM juyu.revision_categories WHERE revision_categories.document_id=p_document;
  DELETE FROM juyu.revision_assets WHERE revision_assets.document_id=p_document;
  DELETE FROM juyu.upload_events WHERE asset_id IN(SELECT a.id FROM juyu.assets a WHERE a.document_id=p_document);
  DELETE FROM juyu.assets WHERE assets.document_id=p_document;
  DELETE FROM juyu.reviews WHERE reviews.document_id=p_document;
  DELETE FROM juyu.audit_log WHERE audit_log.document_id=p_document;
  DELETE FROM juyu.revisions WHERE revisions.document_id=p_document;
  DELETE FROM juyu.documents WHERE id=p_document;
 END IF;
 DELETE FROM juyu.lifecycle_contexts WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND lifecycle_contexts.document_id=p_document;
 RETURN QUERY SELECT p_document,p_action,d.sequence+1,pending;
END $$;
CREATE FUNCTION juyu.finish_storage_cleanup(p_document text,p_job uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE juyu.storage_cleanup_jobs SET completed_at=coalesce(completed_at,clock_timestamp()),completed_by=coalesce(completed_by,juyu.actor_id()) WHERE document_id=p_document AND id=p_job;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
END $$;
REVOKE ALL ON FUNCTION juyu.guard_lifecycle_write(),juyu.guard_purge_delete(),juyu.change_document_lifecycle(text,text,integer,text),juyu.finish_storage_cleanup(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.change_document_lifecycle(text,text,integer,text),juyu.finish_storage_cleanup(text,uuid) TO juyu_runtime;

CREATE FUNCTION juyu.guard_purged_asset_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 -- Recheck the durable tombstone only after any concurrent purge commits.
 PERFORM pg_advisory_xact_lock(hashtextextended('asset:'||NEW.id::text,0));
 IF EXISTS(SELECT 1 FROM juyu.storage_cleanup_jobs WHERE id=NEW.id) THEN RAISE EXCEPTION 'PURGED_ASSET_ID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER purged_asset_identity BEFORE INSERT ON juyu.assets FOR EACH ROW EXECUTE FUNCTION juyu.guard_purged_asset_identity();
REVOKE ALL ON FUNCTION juyu.guard_purged_asset_identity() FROM PUBLIC;

-- Record only the object the POST runner is actually about to attempt.
-- Merely returning a batch must never postpone work the runner did not reach.
CREATE FUNCTION juyu.start_storage_cleanup_attempt(p_document text,p_job uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT EXISTS(SELECT 1 FROM juyu.deletion_receipts WHERE document_id=p_document) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 UPDATE juyu.storage_cleanup_jobs SET last_attempt_at=clock_timestamp()
 WHERE document_id=p_document AND id=p_job AND completed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
END $$;
REVOKE ALL ON FUNCTION juyu.start_storage_cleanup_attempt(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.start_storage_cleanup_attempt(text,uuid) TO juyu_runtime;
