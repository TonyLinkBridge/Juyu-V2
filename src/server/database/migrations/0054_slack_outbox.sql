-- Slack delivery is independent of a successful article transaction. Every
-- queued item refers to one immutable audit event and survives a failed send.
CREATE TABLE juyu.slack_outbox (
 document_id text NOT NULL,
 sequence integer NOT NULL,
 event text NOT NULL CHECK(event IN('revision_started','submitted','approved','changes_requested','published','updated')),
 kind text NOT NULL CHECK(kind IN('article','ops','reference','qa')),
 locale text NOT NULL CHECK(locale IN('zh-CN','en')),
 title text,
 actor_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
 actor_name text NOT NULL,
 reviewer_name text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 claim_id uuid,
 lease_until timestamptz,
 sent_at timestamptz,
 slack_ts text,
 last_error text,
 PRIMARY KEY(document_id,sequence),
 FOREIGN KEY(document_id,sequence) REFERENCES juyu.audit_log(document_id,sequence) ON DELETE CASCADE,
 CHECK((claim_id IS NULL)=(lease_until IS NULL)),
 CHECK(sent_at IS NULL OR slack_ts IS NOT NULL)
);
CREATE INDEX slack_outbox_due ON juyu.slack_outbox(next_attempt_at,created_at)
 WHERE sent_at IS NULL;
ALTER TABLE juyu.slack_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.slack_outbox FROM PUBLIC;
GRANT INSERT ON juyu.slack_outbox TO juyu_runtime;
CREATE POLICY slack_outbox_enqueue ON juyu.slack_outbox FOR INSERT TO juyu_runtime
 WITH CHECK(juyu.is_admin() AND actor_id=juyu.actor_id());
-- The trusted server-only context issuer also delivers Slack messages. It does
-- not gain access to article body, channel history, or the browser API.
GRANT SELECT,UPDATE ON juyu.slack_outbox TO juyu_context_issuer;
CREATE POLICY slack_outbox_worker ON juyu.slack_outbox TO juyu_context_issuer
 USING(true) WITH CHECK(true);
