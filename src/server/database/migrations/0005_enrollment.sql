CREATE TABLE juyu.initialization (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 state text NOT NULL CHECK(state IN ('empty','pending','complete')),
 owner_id text REFERENCES juyu.members(clerk_user_id),
 mode text CHECK(mode IN ('automatic','existing')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,
 CHECK((state='empty' AND owner_id IS NULL AND mode IS NULL AND completed_at IS NULL)
   OR (state='pending' AND owner_id IS NOT NULL AND mode='automatic' AND completed_at IS NULL)
   OR (state='complete' AND mode IS NOT NULL AND completed_at IS NOT NULL))
);
-- Upgrading a populated system must never reopen automatic administrator assignment.
INSERT INTO juyu.initialization(state,mode,completed_at)
 SELECT CASE WHEN EXISTS(SELECT 1 FROM juyu.members) THEN 'complete' ELSE 'empty' END,
 CASE WHEN EXISTS(SELECT 1 FROM juyu.members) THEN 'existing' ELSE NULL END,
 CASE WHEN EXISTS(SELECT 1 FROM juyu.members) THEN clock_timestamp() ELSE NULL END;
CREATE TABLE juyu.role_enrollments (
 member_id text PRIMARY KEY REFERENCES juyu.members(clerk_user_id),
 requested_role text NOT NULL CHECK(requested_role IN ('admin','support')),
 purpose text NOT NULL CHECK(purpose IN ('bootstrap','default')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),confirmed_at timestamptz,
 CHECK((purpose='bootstrap' AND requested_role='admin') OR (purpose='default' AND requested_role='support')),
 CHECK((state='pending')=(confirmed_at IS NULL))
);
CREATE UNIQUE INDEX one_bootstrap_enrollment ON juyu.role_enrollments((true)) WHERE purpose='bootstrap';
ALTER TABLE juyu.initialization ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.role_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.initialization,juyu.role_enrollments FROM PUBLIC;
GRANT SELECT,UPDATE ON juyu.initialization TO juyu_context_issuer;
GRANT SELECT,INSERT,UPDATE ON juyu.role_enrollments TO juyu_context_issuer;
CREATE POLICY issuer_initialization ON juyu.initialization TO juyu_context_issuer USING(true) WITH CHECK(true);
CREATE POLICY issuer_enrollment ON juyu.role_enrollments TO juyu_context_issuer USING(true) WITH CHECK(true);

CREATE FUNCTION juyu.protect_initialization() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.state='complete' THEN RAISE EXCEPTION 'IMMUTABLE: initialization'; END IF;
 IF NEW.singleton IS DISTINCT FROM OLD.singleton OR NEW.created_at IS DISTINCT FROM OLD.created_at
 OR (OLD.state='pending' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.mode IS DISTINCT FROM OLD.mode OR NEW.state<>'complete'))
 OR (OLD.state='empty' AND NEW.state NOT IN ('pending','complete')) THEN RAISE EXCEPTION 'IMMUTABLE: initialization owner'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER initialization_history BEFORE UPDATE OR DELETE ON juyu.initialization FOR EACH ROW EXECUTE FUNCTION juyu.protect_initialization();
CREATE FUNCTION juyu.protect_enrollment() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.state='complete' THEN RAISE EXCEPTION 'IMMUTABLE: enrollment'; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','confirmed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','confirmed_at'])
 OR NEW.state<>'complete' THEN RAISE EXCEPTION 'IMMUTABLE: enrollment intent'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enrollment_history BEFORE UPDATE OR DELETE ON juyu.role_enrollments FOR EACH ROW EXECUTE FUNCTION juyu.protect_enrollment();
REVOKE ALL ON FUNCTION juyu.protect_initialization(),juyu.protect_enrollment() FROM PUBLIC;
CREATE OR REPLACE FUNCTION juyu.current_identity() RETURNS TABLE(member_id text,role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT c.member_id,c.role FROM juyu.request_contexts c JOIN juyu.members m ON m.clerk_user_id=c.member_id
 WHERE c.token_hash=encode(sha256(convert_to(current_setting('juyu.token',true),'UTF8')),'hex')
 AND m.observed_role=c.role AND c.backend_pid=pg_backend_pid() AND c.expires_at>clock_timestamp() AND m.disabled_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM juyu.member_operations o WHERE o.target_id=m.clerk_user_id AND o.status='pending')
 AND NOT EXISTS(SELECT 1 FROM juyu.role_enrollments e WHERE e.member_id=m.clerk_user_id AND e.state='pending')
$$;
