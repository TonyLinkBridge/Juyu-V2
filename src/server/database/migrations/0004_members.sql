ALTER TABLE juyu.members ADD COLUMN observed_role text CHECK(observed_role IN ('support','ops','admin')),
 ADD COLUMN verified_email text, ADD COLUMN observed_at timestamptz;
CREATE TABLE juyu.member_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
 target_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
 kind text NOT NULL CHECK(kind IN ('role','disable')),
 before_role text CHECK(before_role IN ('support','ops','admin')),
 requested_role text CHECK(requested_role IN ('support','ops','admin')),
 requested_disabled boolean, before_disabled boolean,
 observed_role text CHECK(observed_role IN ('support','ops','admin')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','conflict')),
 reconciled_by text REFERENCES juyu.members(clerk_user_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz,
 CHECK((status='pending')=(finished_at IS NULL)),
 CHECK((kind='role' AND requested_role IS NOT NULL AND requested_disabled IS NULL) OR (kind='disable' AND requested_role IS NULL AND requested_disabled IS NOT NULL))
);
-- Durable global exclusion survives process termination; a pending write must be reconciled first.
CREATE UNIQUE INDEX member_operation_pending ON juyu.member_operations((true)) WHERE status='pending';
ALTER TABLE juyu.member_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.member_operations FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON juyu.members,juyu.member_operations TO juyu_context_issuer;
CREATE POLICY issuer_members ON juyu.members TO juyu_context_issuer USING(true) WITH CHECK(true);
CREATE POLICY issuer_member_operations ON juyu.member_operations TO juyu_context_issuer USING(true) WITH CHECK(true);
-- The auth issuer already mints server-verified contexts; it is never exposed to browser/runtime SQL.
GRANT SELECT ON juyu.member_operations TO juyu_runtime;
CREATE POLICY member_operations_read ON juyu.member_operations FOR SELECT TO juyu_runtime USING(juyu.is_admin());
CREATE OR REPLACE FUNCTION juyu.current_identity() RETURNS TABLE(member_id text,role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT c.member_id,c.role FROM juyu.request_contexts c JOIN juyu.members m ON m.clerk_user_id=c.member_id
 WHERE c.token_hash=encode(sha256(convert_to(current_setting('juyu.token',true),'UTF8')),'hex')
 AND m.observed_role=c.role
 AND c.backend_pid=pg_backend_pid() AND c.expires_at>clock_timestamp() AND m.disabled_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM juyu.member_operations o WHERE o.target_id=m.clerk_user_id AND o.status='pending')
$$;

CREATE FUNCTION juyu.protect_member_operation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status<>'pending' THEN RAISE EXCEPTION 'IMMUTABLE: member history'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','observed_role','finished_at','reconciled_by'])
   IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','observed_role','finished_at','reconciled_by'])
 THEN RAISE EXCEPTION 'IMMUTABLE: original member intent'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION juyu.protect_member_operation() FROM PUBLIC;
CREATE TRIGGER member_operation_history BEFORE UPDATE OR DELETE ON juyu.member_operations
FOR EACH ROW EXECUTE FUNCTION juyu.protect_member_operation();
