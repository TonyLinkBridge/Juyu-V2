-- Read-only inventory before initializing the designated Supabase project.
-- Do not infer an empty database from an empty public schema alone.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name, current_user AS operator,
       current_setting('server_version') AS postgres_version;
SELECT nspname AS schema_name, pg_get_userbyid(nspowner) AS owner
FROM pg_namespace WHERE nspname IN ('juyu', 'public', 'storage');
SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind,
       c.relrowsecurity AS rls_enabled, pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='juyu' AND c.relkind IN ('r','p','v','m') ORDER BY c.relname;
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
FROM pg_roles WHERE rolname LIKE 'juyu%'
ORDER BY rolname;
SELECT granted.rolname AS granted_role, member.rolname AS member_role
FROM pg_auth_members membership
JOIN pg_roles granted ON granted.oid=membership.roleid
JOIN pg_roles member ON member.oid=membership.member
WHERE granted.rolname LIKE 'juyu%' OR member.rolname LIKE 'juyu%';
SELECT to_regclass('juyu.schema_migrations') AS migration_ledger,
       to_regclass('juyu.members') AS members_table,
       to_regclass('storage.buckets') AS storage_buckets;
COMMIT;
