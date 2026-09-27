-- Deleted category identities stay in the immutable settings history, but an
-- irreversible deletion must never be presented as a restorable version.
CREATE OR REPLACE FUNCTION juyu.read_setting_history_detail(p_kind text,p_id uuid,p_version integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE item record;prior jsonb;current_config jsonb;restorable boolean:=true;
BEGIN
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_kind IS NULL OR p_kind NOT IN('field','category','form','navigation','features') OR p_id IS NULL OR p_version IS NULL OR p_version<1 OR p_version>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 SELECT * INTO item FROM juyu.setting_history_rows() h WHERE h.kind=p_kind AND h.id=p_id AND h.version=p_version;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT h.config INTO prior FROM juyu.setting_history_rows() h WHERE h.kind=p_kind AND h.id=p_id AND h.version=p_version-1;
 IF p_version=1 AND p_kind='navigation' THEN prior:=jsonb_build_object('entries',juyu.default_navigation_entries());ELSIF p_version=1 AND p_kind='features' THEN prior:='{"flags":{"search":true,"pdfExport":true,"favorites":true,"recent":true,"feedback":true,"analytics":true,"forms":true}}';END IF;
 SELECT h.config INTO current_config FROM juyu.setting_history_rows() h WHERE h.kind=p_kind AND h.id=p_id AND h.version=item.current_version;
 IF current_config IS NULL OR (p_version>1 AND prior IS NULL) THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 IF p_kind='category' THEN SELECT c.deleted_at IS NULL INTO restorable FROM juyu.categories c WHERE c.id=p_id;END IF;
 RETURN jsonb_build_object('entry',juyu.history_entry(item.kind,item.id,item.version,item.config,item.actor,item.stamp),'before',prior,'after',item.config,'current',jsonb_build_object('version',item.current_version,'config',current_config),'restorable',restorable);
END $$;
