-- Super Admin inherits every existing Admin permission. Exact checks remain
-- separate so only this role can use direct publication and role escalation.
ALTER TABLE juyu.request_contexts DROP CONSTRAINT request_contexts_role_check;
ALTER TABLE juyu.request_contexts ADD CONSTRAINT request_contexts_role_check
 CHECK(role IN('support','ops','admin','super_admin'));

ALTER TABLE juyu.members DROP CONSTRAINT members_observed_role_check;
ALTER TABLE juyu.members ADD CONSTRAINT members_observed_role_check
 CHECK(observed_role IN('support','ops','admin','super_admin'));

ALTER TABLE juyu.member_operations DROP CONSTRAINT member_operations_before_role_check;
ALTER TABLE juyu.member_operations ADD CONSTRAINT member_operations_before_role_check
 CHECK(before_role IN('support','ops','admin','super_admin'));
ALTER TABLE juyu.member_operations DROP CONSTRAINT member_operations_requested_role_check;
ALTER TABLE juyu.member_operations ADD CONSTRAINT member_operations_requested_role_check
 CHECK(requested_role IN('support','ops','admin','super_admin'));
ALTER TABLE juyu.member_operations DROP CONSTRAINT member_operations_observed_role_check;
ALTER TABLE juyu.member_operations ADD CONSTRAINT member_operations_observed_role_check
 CHECK(observed_role IN('support','ops','admin','super_admin'));

CREATE OR REPLACE FUNCTION juyu.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT coalesce((SELECT role IN('admin','super_admin') FROM juyu.current_identity()),false)
$$;

CREATE OR REPLACE FUNCTION juyu.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT coalesce((SELECT role='super_admin' FROM juyu.current_identity()),false)
$$;
REVOKE ALL ON FUNCTION juyu.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.is_super_admin() TO juyu_runtime;

CREATE OR REPLACE FUNCTION juyu.audience_allowed(audience text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT coalesce((SELECT audience='staff'
  OR (audience='ops' AND role IN('ops','admin','super_admin'))
  OR (audience='admin' AND role IN('admin','super_admin'))
  FROM juyu.current_identity()),false)
$$;

CREATE OR REPLACE FUNCTION juyu.review_admin_eligible(p_member text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT juyu.is_admin() AND EXISTS(
  SELECT 1 FROM juyu.members m WHERE m.clerk_user_id=p_member AND m.observed_role IN('admin','super_admin')
  AND m.disabled_at IS NULL AND nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM juyu.member_operations o WHERE o.target_id=m.clerk_user_id AND o.status='pending')
  AND NOT EXISTS(SELECT 1 FROM juyu.role_enrollments e WHERE e.member_id=m.clerk_user_id AND e.state='pending')
 )
$$;

CREATE OR REPLACE FUNCTION juyu.can_read_document(document text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE source_id text;allowed boolean;
BEGIN
 SELECT d.translation_of,
  d.lifecycle='active' AND juyu.audience_allowed(r.audience)
   AND (d.kind<>'ops' OR (SELECT role FROM juyu.current_identity()) IN('ops','admin','super_admin'))
   AND NOT EXISTS(SELECT 1 FROM juyu.revision_categories rc
    WHERE rc.document_id=d.id AND rc.revision_id=r.revision_id AND NOT juyu.category_allowed(rc.category_id))
 INTO source_id,allowed
 FROM juyu.documents d JOIN juyu.revisions r
  ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 WHERE d.id=document;
 IF NOT coalesce(allowed,false) THEN RETURN false;END IF;
 IF source_id IS NULL THEN RETURN true;END IF;
 RETURN juyu.can_read_document(source_id);
END $$;

CREATE OR REPLACE FUNCTION juyu.read_ops_publications()
RETURNS TABLE(id text,title text,revision integer,tags text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE i.role IN('ops','admin','super_admin') AND m.verified_email IS NOT NULL AND m.observed_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN QUERY
  SELECT d.id,r.title,r.revision_id,r.tags
  FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
  WHERE d.kind='ops' AND d.lifecycle='active' AND juyu.can_read_document(d.id);
END $$;

CREATE OR REPLACE FUNCTION juyu.announcement_target_allowed(target text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE role text;feature text;
BEGIN
 IF NOT juyu.navigation_member_eligible() OR target IS NULL OR target NOT IN('search','pdf','favorites','recent','feedback','forms','ops','reference','qa','editor','analytics','history') THEN RETURN false;END IF;
 SELECT CASE WHEN i.role='super_admin' THEN 'admin' ELSE i.role END INTO role FROM juyu.current_identity() i;
 IF (target IN('editor','analytics','history') AND role<>'admin') OR (target='ops' AND role NOT IN('ops','admin')) THEN RETURN false;END IF;
 feature:=juyu.announcement_feature(target);RETURN feature IS NULL OR coalesce((juyu.feature_config()->'flags'->>feature)::boolean,false);
END $$;

CREATE OR REPLACE FUNCTION juyu.read_reader_menu() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE role text;config jsonb;
BEGIN
 IF NOT juyu.navigation_member_eligible() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT CASE WHEN i.role='super_admin' THEN 'admin' ELSE i.role END INTO role FROM juyu.current_identity() i;
 config:=juyu.navigation_config();
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',e->'id','label',e->'label','href',CASE WHEN e->'target'->>'type'='category' THEN '/help-centre/categories/'||(e->'target'->>'categoryId') WHEN e->'target'->>'page'='home' THEN '/help-centre' ELSE '/help-centre/'||(e->'target'->>'page') END) ORDER BY position),'[]')
  FROM jsonb_array_elements(config->'entries') WITH ORDINALITY AS entries(e,position)
  WHERE (e->>'enabled')::boolean AND e->'roles' @> jsonb_build_array(role)
   AND CASE WHEN e->'target'->>'type'='category' THEN juyu.navigation_category_allowed((e->'target'->>'categoryId')::uuid) ELSE e->'target'->>'page'<>'ops' OR role IN('ops','admin') END);
END $$;
