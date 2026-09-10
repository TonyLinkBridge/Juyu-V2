DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='juyu_runtime') THEN CREATE ROLE juyu_runtime NOLOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='juyu_context_issuer') THEN CREATE ROLE juyu_context_issuer NOLOGIN NOBYPASSRLS; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('juyu_runtime','juyu_context_issuer') AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolcanlogin)) THEN
    RAISE EXCEPTION 'UNSAFE_DATABASE_ROLE: conflicting role already exists';
  END IF;
END $$;
GRANT USAGE ON SCHEMA juyu TO juyu_runtime,juyu_context_issuer;

CREATE TABLE juyu.request_contexts (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  backend_pid integer NOT NULL,
  member_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  role text NOT NULL CHECK (role IN ('support','ops','admin')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at>created_at AND expires_at<=created_at+interval '65 seconds')
);
CREATE INDEX request_context_expiry ON juyu.request_contexts(expires_at);
ALTER TABLE juyu.request_contexts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.request_contexts FROM PUBLIC;
GRANT SELECT,INSERT,DELETE ON juyu.request_contexts TO juyu_context_issuer;
CREATE POLICY issuer_context ON juyu.request_contexts TO juyu_context_issuer USING (true) WITH CHECK (true);

CREATE FUNCTION juyu.current_identity() RETURNS TABLE(member_id text,role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT c.member_id,c.role FROM juyu.request_contexts c JOIN juyu.members m ON m.clerk_user_id=c.member_id
  WHERE c.token_hash=encode(sha256(convert_to(current_setting('juyu.token',true),'UTF8')),'hex')
    AND c.backend_pid=pg_backend_pid() AND c.expires_at>clock_timestamp() AND m.disabled_at IS NULL
$$;
CREATE FUNCTION juyu.actor_id() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT member_id FROM juyu.current_identity()
$$;
CREATE FUNCTION juyu.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT coalesce((SELECT role='admin' FROM juyu.current_identity()),false)
$$;
CREATE FUNCTION juyu.audience_allowed(audience text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT coalesce((SELECT audience='staff' OR (audience='ops' AND role IN ('ops','admin')) OR (audience='admin' AND role='admin') FROM juyu.current_identity()),false)
$$;
CREATE FUNCTION juyu.category_allowed(category uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  WITH RECURSIVE ancestors AS (
    SELECT c.id,c.parent_id,c.enabled,c.audience,ARRAY[c.id] AS path,false AS cycle FROM juyu.categories c WHERE c.id=category
    UNION ALL
    SELECT c.id,c.parent_id,c.enabled,c.audience,a.path||c.id,c.id=ANY(a.path)
    FROM juyu.categories c JOIN ancestors a ON c.id=a.parent_id WHERE NOT a.cycle
  ) SELECT coalesce(bool_and(enabled AND juyu.audience_allowed(audience) AND NOT cycle) AND bool_or(parent_id IS NULL),false) FROM ancestors
$$;
CREATE FUNCTION juyu.can_read_document(document text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT EXISTS (
    SELECT 1 FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
    WHERE d.id=document AND d.lifecycle='active' AND juyu.audience_allowed(r.audience)
      AND (d.kind<>'ops' OR (SELECT role FROM juyu.current_identity()) IN ('ops','admin'))
      AND NOT EXISTS (SELECT 1 FROM juyu.revision_categories rc WHERE rc.document_id=d.id AND rc.revision_id=r.revision_id AND NOT juyu.category_allowed(rc.category_id))
  )
$$;
CREATE FUNCTION juyu.can_read_revision(document text,revision integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT EXISTS (SELECT 1 FROM juyu.documents d WHERE d.id=document AND d.published_revision_id=revision AND juyu.can_read_document(d.id))
$$;
CREATE FUNCTION juyu.read_publication(document text) RETURNS TABLE(document_id text,kind text,revision_id integer,title text,body text,audience text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT d.id,d.kind,r.revision_id,r.title,r.body,r.audience FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
  WHERE d.id=document AND juyu.can_read_document(d.id)
$$;
CREATE FUNCTION juyu.can_read_asset(asset uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT EXISTS(SELECT 1 FROM juyu.assets a JOIN juyu.revision_assets ra ON ra.asset_id=a.id AND ra.document_id=a.document_id
    WHERE a.id=asset AND a.status='ready' AND juyu.can_read_revision(ra.document_id,ra.revision_id))
$$;
CREATE FUNCTION juyu.notification_allowed(notification uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
  SELECT EXISTS(SELECT 1 FROM juyu.notifications n WHERE n.id=notification AND n.enabled AND n.starts_at<=clock_timestamp()
    AND (n.expires_at IS NULL OR n.expires_at>clock_timestamp()) AND juyu.audience_allowed(n.audience)
    AND (n.target_document_id IS NULL OR juyu.can_read_document(n.target_document_id))
    AND (n.feature_setting_id IS NULL OR EXISTS(SELECT 1 FROM juyu.settings s JOIN juyu.setting_versions v ON v.setting_id=s.id AND v.version=s.current_version
      WHERE s.id=n.feature_setting_id AND s.kind='feature_flag' AND s.enabled AND v.config->'enabled'='true'::jsonb)))
$$;

GRANT SELECT ON juyu.members,juyu.documents,juyu.revisions,juyu.reviews,juyu.audit_log,juyu.categories,juyu.revision_categories,juyu.assets,juyu.revision_assets,juyu.favorites,juyu.recent_views,juyu.feedback,juyu.search_queries,juyu.search_results,juyu.analytics_events,juyu.settings,juyu.setting_versions,juyu.notifications,juyu.notification_receipts TO juyu_runtime;
-- Row locking needs an UPDATE privilege; no UPDATE policy permits changing members.
GRANT UPDATE(display_name) ON juyu.members TO juyu_runtime;
GRANT INSERT,UPDATE ON juyu.documents,juyu.reviews TO juyu_runtime;
GRANT INSERT ON juyu.revisions,juyu.audit_log TO juyu_runtime;
CREATE POLICY members_read ON juyu.members FOR SELECT TO juyu_runtime USING (juyu.is_admin() OR clerk_user_id=juyu.actor_id());
CREATE POLICY members_lock ON juyu.members FOR UPDATE TO juyu_runtime USING (juyu.is_admin()) WITH CHECK (false);
CREATE POLICY documents_read ON juyu.documents FOR SELECT TO juyu_runtime USING (juyu.is_admin());
CREATE POLICY documents_insert ON juyu.documents FOR INSERT TO juyu_runtime WITH CHECK (juyu.is_admin());
CREATE POLICY documents_update ON juyu.documents FOR UPDATE TO juyu_runtime USING (juyu.is_admin()) WITH CHECK (juyu.is_admin());
CREATE POLICY revisions_read ON juyu.revisions FOR SELECT TO juyu_runtime USING (juyu.is_admin() OR juyu.can_read_revision(document_id,revision_id));
CREATE POLICY revisions_insert ON juyu.revisions FOR INSERT TO juyu_runtime WITH CHECK (juyu.is_admin() AND editor_id=juyu.actor_id());
CREATE POLICY reviews_read ON juyu.reviews FOR SELECT TO juyu_runtime USING (juyu.is_admin());
CREATE POLICY reviews_insert ON juyu.reviews FOR INSERT TO juyu_runtime WITH CHECK (juyu.is_admin() AND submitted_by=juyu.actor_id() AND status='in_review');
CREATE POLICY reviews_update ON juyu.reviews FOR UPDATE TO juyu_runtime USING (juyu.is_admin()) WITH CHECK (juyu.is_admin() AND (status='in_review' OR (decided_by=juyu.actor_id() AND (status='withdrawn' OR reviewer_id=juyu.actor_id()))));
CREATE POLICY audit_read ON juyu.audit_log FOR SELECT TO juyu_runtime USING (juyu.is_admin());
CREATE POLICY audit_insert ON juyu.audit_log FOR INSERT TO juyu_runtime WITH CHECK (juyu.is_admin() AND actor_id=juyu.actor_id());
CREATE POLICY categories_read ON juyu.categories FOR SELECT TO juyu_runtime USING (juyu.is_admin() OR juyu.category_allowed(id));
CREATE POLICY revision_categories_read ON juyu.revision_categories FOR SELECT TO juyu_runtime USING (juyu.is_admin() OR (juyu.can_read_revision(document_id,revision_id) AND juyu.category_allowed(category_id)));
CREATE POLICY assets_read ON juyu.assets FOR SELECT TO juyu_runtime USING (juyu.is_admin() OR juyu.can_read_asset(id));
CREATE POLICY revision_assets_read ON juyu.revision_assets FOR SELECT TO juyu_runtime USING (juyu.is_admin() OR (juyu.can_read_revision(document_id,revision_id) AND juyu.can_read_asset(asset_id)));
CREATE POLICY favorites_read ON juyu.favorites FOR SELECT TO juyu_runtime USING (member_id=juyu.actor_id() AND juyu.can_read_document(document_id));
CREATE POLICY recent_read ON juyu.recent_views FOR SELECT TO juyu_runtime USING (member_id=juyu.actor_id() AND juyu.can_read_revision(document_id,revision_id));
CREATE POLICY feedback_read ON juyu.feedback FOR SELECT TO juyu_runtime USING (juyu.is_admin() OR (member_id=juyu.actor_id() AND juyu.can_read_revision(document_id,revision_id)));
CREATE POLICY queries_read ON juyu.search_queries FOR SELECT TO juyu_runtime USING (juyu.is_admin());
CREATE POLICY results_read ON juyu.search_results FOR SELECT TO juyu_runtime USING (juyu.is_admin());
CREATE POLICY events_read ON juyu.analytics_events FOR SELECT TO juyu_runtime USING (juyu.is_admin());
CREATE POLICY settings_read ON juyu.settings FOR SELECT TO juyu_runtime USING (juyu.is_admin());
CREATE POLICY setting_versions_read ON juyu.setting_versions FOR SELECT TO juyu_runtime USING (juyu.is_admin());
CREATE POLICY notifications_read ON juyu.notifications FOR SELECT TO juyu_runtime USING (juyu.is_admin() OR juyu.notification_allowed(id));
CREATE POLICY receipts_read ON juyu.notification_receipts FOR SELECT TO juyu_runtime USING (member_id=juyu.actor_id() AND juyu.notification_allowed(notification_id));

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA juyu FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.current_identity(),juyu.actor_id(),juyu.is_admin(),juyu.audience_allowed(text),juyu.category_allowed(uuid),juyu.can_read_document(text),juyu.can_read_revision(text,integer),juyu.read_publication(text),juyu.can_read_asset(uuid),juyu.notification_allowed(uuid) TO juyu_runtime;
