-- Operational metadata only. Never store credentials, request bodies, query strings or vendor messages.
CREATE TABLE juyu.developer_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 at timestamptz NOT NULL DEFAULT clock_timestamp(),
 source text NOT NULL CHECK(source IN('request','connection','publication-client','operator')),
 name text NOT NULL CHECK(name ~ '^[a-z][a-z0-9_.-]{0,63}$'),
 level text NOT NULL CHECK(level IN('info','warning','error')),
 status integer CHECK(status BETWEEN 100 AND 599),
 duration_ms integer CHECK(duration_ms BETWEEN 0 AND 3600000),
 actor_id text,document_id text,sequence integer,
 operation_id uuid UNIQUE,
 code text CHECK(code IN('CHECK_OK','CHECK_FAILED','PRIVATE_BUCKET_REQUIRED','SLACK_WORKSPACE_MISMATCH','SCHEDULER_NOT_PROBED')),
 diagnostic jsonb
);
CREATE INDEX developer_events_recent ON juyu.developer_events(at DESC,id DESC);
CREATE INDEX developer_events_source_recent ON juyu.developer_events(source,at DESC);
ALTER TABLE juyu.developer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.developer_events FROM PUBLIC;
GRANT SELECT ON juyu.developer_events TO juyu_runtime;
CREATE POLICY developers_read ON juyu.developer_events FOR SELECT TO juyu_runtime
 USING(juyu.is_super_admin() AND juyu.review_admin_eligible(juyu.actor_id()));
GRANT SELECT,INSERT,DELETE ON juyu.developer_events TO juyu_context_issuer;
GRANT USAGE ON SEQUENCE juyu.developer_events_id_seq TO juyu_context_issuer;
CREATE POLICY developer_event_worker_read ON juyu.developer_events FOR SELECT TO juyu_context_issuer USING(true);
CREATE POLICY developer_event_worker_insert ON juyu.developer_events FOR INSERT TO juyu_context_issuer WITH CHECK(source<>'operator');
CREATE POLICY developer_event_worker_delete ON juyu.developer_events FOR DELETE TO juyu_context_issuer USING(source<>'operator');
GRANT SELECT ON juyu.slack_outbox TO juyu_runtime;
CREATE POLICY developers_notification_read ON juyu.slack_outbox FOR SELECT TO juyu_runtime
 USING(juyu.is_super_admin() AND juyu.review_admin_eligible(juyu.actor_id()));

CREATE FUNCTION juyu.retry_slack_notification(p_document text,p_sequence integer,p_operation uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE actor text;receipt juyu.developer_events%ROWTYPE;updated integer;
BEGIN
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY'; END IF;
 actor:=juyu.actor_id();
 IF NOT juyu.is_super_admin() OR NOT juyu.review_admin_eligible(actor)
  OR NOT EXISTS(SELECT 1 FROM juyu.members WHERE clerk_user_id=actor AND observed_role='super_admin') THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_document IS NULL OR p_document='' OR p_sequence IS NULL OR p_sequence<0 OR p_operation IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 SELECT * INTO receipt FROM juyu.developer_events WHERE operation_id=p_operation;
 IF FOUND THEN
  IF receipt.actor_id<>actor OR receipt.document_id<>p_document OR receipt.sequence<>p_sequence THEN RAISE EXCEPTION 'CONFLICT';END IF;
  RETURN false;
 END IF;
 UPDATE juyu.slack_outbox SET next_attempt_at=clock_timestamp(),claim_id=NULL,lease_until=NULL
 WHERE document_id=p_document AND sequence=p_sequence AND sent_at IS NULL AND last_error IS NOT NULL
  AND (lease_until IS NULL OR lease_until<=clock_timestamp());
 GET DIAGNOSTICS updated=ROW_COUNT;
 IF updated<>1 THEN RAISE EXCEPTION 'CONFLICT';END IF;
 INSERT INTO juyu.developer_events(source,name,level,actor_id,document_id,sequence,operation_id)
 VALUES('operator','retry','info',actor,p_document,p_sequence,p_operation);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION juyu.retry_slack_notification(text,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.retry_slack_notification(text,integer,uuid) TO juyu_runtime;
