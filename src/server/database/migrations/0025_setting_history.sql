-- Restore provenance is separate immutable evidence; existing history remains untouched.
CREATE TABLE juyu.setting_restorations(
 request_id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN('field','category','form','navigation','features')),
 entity_id uuid NOT NULL,source_version integer NOT NULL CHECK(source_version>0),expected_version integer NOT NULL CHECK(expected_version>=source_version),
 new_version integer NOT NULL CHECK(new_version=expected_version+1),actor_id text NOT NULL REFERENCES juyu.members(clerk_user_id),at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(kind,entity_id,new_version)
);
ALTER TABLE juyu.setting_restorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.setting_restorations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.setting_restorations FROM PUBLIC,juyu_runtime;
CREATE TRIGGER restoration_immutable BEFORE UPDATE OR DELETE ON juyu.setting_restorations FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();
CREATE FUNCTION juyu.setting_history_rows() RETURNS TABLE(kind text,id uuid,version integer,config jsonb,actor text,stamp timestamptz,current_version integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT CASE WHEN s.kind='field' THEN 'field' WHEN s.key='reader-navigation' THEN 'navigation' ELSE 'features' END,s.id,v.version,v.config,v.changed_by,v.created_at,s.current_version
 FROM juyu.settings s JOIN juyu.setting_versions v ON v.setting_id=s.id
 WHERE (s.kind='field' AND s.key='field-'||s.id::text) OR (s.kind='navigation' AND s.key='reader-navigation') OR(s.kind='feature_flag' AND s.key='feature-flags')
 UNION ALL SELECT 'category',c.id,v.version,v.config,v.changed_by,v.changed_at,c.current_version FROM juyu.categories c JOIN juyu.category_versions v ON v.category_id=c.id
 UNION ALL SELECT 'form',f.id,v.version,v.config,v.changed_by,v.changed_at,f.current_version FROM juyu.forms f JOIN juyu.form_versions v ON v.form_id=f.id
$$;
CREATE FUNCTION juyu.history_entry(p_kind text,p_id uuid,p_version integer,p_config jsonb,p_actor text,p_stamp timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT jsonb_build_object('kind',p_kind,'id',p_id,'version',p_version,'label',CASE WHEN p_kind='features' THEN '功能开关' WHEN p_kind='navigation' THEN '导航设置' ELSE coalesce(p_config->>'name',p_config->>'title','未命名设置') END,
 'actor',CASE WHEN p_actor IS NULL THEN NULL ELSE jsonb_build_object('id',p_actor,'name',coalesce((SELECT nullif(display_name,'') FROM juyu.members WHERE clerk_user_id=p_actor),p_actor)) END,
 'changedAt',p_stamp,'restoredFrom',(SELECT source_version FROM juyu.setting_restorations WHERE kind=p_kind AND entity_id=p_id AND new_version=p_version))
$$;
CREATE FUNCTION juyu.read_setting_history(p_kind text,p_page integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE total integer;pages integer;page integer;items jsonb;
BEGIN
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_kind IS NULL OR p_kind NOT IN('all','field','category','form','navigation','features') OR p_page IS NULL OR p_page<1 OR p_page>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 SELECT count(*) INTO total FROM juyu.setting_history_rows() h WHERE p_kind='all' OR h.kind=p_kind;pages:=greatest(1,ceil(total/20.0)::integer);page:=least(p_page,pages);
 SELECT coalesce(jsonb_agg(juyu.history_entry(h.kind,h.id,h.version,h.config,h.actor,h.stamp) ORDER BY h.stamp DESC,h.kind,h.id,h.version DESC),'[]') INTO items FROM(SELECT * FROM juyu.setting_history_rows() h WHERE p_kind='all' OR h.kind=p_kind ORDER BY h.stamp DESC,h.kind,h.id,h.version DESC LIMIT 20 OFFSET (page-1)*20) h;
 RETURN jsonb_build_object('items',items,'total',total,'page',page,'pages',pages);
END $$;
CREATE FUNCTION juyu.read_setting_history_detail(p_kind text,p_id uuid,p_version integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE item record;prior jsonb;current_config jsonb;
BEGIN
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_kind IS NULL OR p_kind NOT IN('field','category','form','navigation','features') OR p_id IS NULL OR p_version IS NULL OR p_version<1 OR p_version>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 SELECT * INTO item FROM juyu.setting_history_rows() h WHERE h.kind=p_kind AND h.id=p_id AND h.version=p_version;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT h.config INTO prior FROM juyu.setting_history_rows() h WHERE h.kind=p_kind AND h.id=p_id AND h.version=p_version-1;
 -- The first save of these two fixed singleton settings starts from known system defaults.
 IF p_version=1 AND p_kind='navigation' THEN prior:=jsonb_build_object('entries',juyu.default_navigation_entries());ELSIF p_version=1 AND p_kind='features' THEN prior:='{"flags":{"search":true,"pdfExport":true,"favorites":true,"recent":true,"feedback":true,"analytics":true,"forms":true}}';END IF;
 SELECT h.config INTO current_config FROM juyu.setting_history_rows() h WHERE h.kind=p_kind AND h.id=p_id AND h.version=item.current_version;
 IF current_config IS NULL OR (p_version>1 AND prior IS NULL) THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 RETURN jsonb_build_object('entry',juyu.history_entry(item.kind,item.id,item.version,item.config,item.actor,item.stamp),'before',prior,'after',item.config,'current',jsonb_build_object('version',item.current_version,'config',current_config));
END $$;
CREATE FUNCTION juyu.restore_setting(p_kind text,p_id uuid,p_source integer,p_expected integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;saved juyu.setting_restorations;current_version integer;source jsonb;result jsonb;lock_id bigint;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN('field','category','form','navigation','features') OR p_id IS NULL OR p_request IS NULL OR p_source IS NULL OR p_source<1 OR p_expected IS NULL OR p_source>=p_expected OR p_expected>=2147483646 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF NOT pg_try_advisory_xact_lock(84620953) THEN RAISE EXCEPTION 'HISTORY_BUSY';END IF;
 -- Lock rather than race a member change; all domain locks below use try-lock to avoid lock inversion.
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO saved FROM juyu.setting_restorations WHERE request_id=p_request;
 IF FOUND THEN
  IF (saved.kind,saved.entity_id,saved.source_version,saved.expected_version,saved.actor_id) IS DISTINCT FROM (p_kind,p_id,p_source,p_expected,who) THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
 ELSE
  IF p_kind='form' THEN PERFORM juyu.require_feature('forms');END IF;
  lock_id:=CASE p_kind WHEN 'field' THEN 84620948 WHEN 'category' THEN 84620949 WHEN 'form' THEN 84620950 WHEN 'navigation' THEN 84620951 ELSE 84620952 END;
  IF NOT pg_try_advisory_xact_lock(lock_id) THEN RAISE EXCEPTION 'HISTORY_BUSY';END IF;
  IF p_kind='form' AND NOT pg_try_advisory_xact_lock(84620948) THEN RAISE EXCEPTION 'HISTORY_BUSY';END IF;
  SELECT h.current_version,h.config INTO current_version,source FROM juyu.setting_history_rows() h WHERE h.kind=p_kind AND h.id=p_id AND h.version=p_source;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  IF current_version<>p_expected THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
  CASE p_kind
   WHEN 'field' THEN result:=juyu.write_field_definition(p_id,p_expected,source);
   WHEN 'category' THEN result:=juyu.write_category_definition(p_id,p_expected,source);
   WHEN 'form' THEN SELECT v.request INTO source FROM juyu.form_versions v WHERE v.form_id=p_id AND v.version=p_source;result:=juyu.write_form(p_id,p_expected,source);
   WHEN 'navigation' THEN result:=juyu.write_navigation_settings(p_expected,source->'entries');
   WHEN 'features' THEN result:=juyu.write_feature_config(p_expected,source->'flags');
  END CASE;
  IF (result->>'version')::integer IS DISTINCT FROM p_expected+1 THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
  INSERT INTO juyu.setting_restorations(request_id,kind,entity_id,source_version,expected_version,new_version,actor_id) VALUES(p_request,p_kind,p_id,p_source,p_expected,p_expected+1,who) RETURNING * INTO saved;
 END IF;
 RETURN jsonb_build_object('requestId',saved.request_id,'kind',saved.kind,'id',saved.entity_id,'version',saved.source_version,'expectedVersion',saved.expected_version,'newVersion',saved.new_version);
END $$;
REVOKE ALL ON FUNCTION juyu.setting_history_rows(),juyu.history_entry(text,uuid,integer,jsonb,text,timestamptz),juyu.read_setting_history(text,integer),juyu.read_setting_history_detail(text,uuid,integer),juyu.restore_setting(text,uuid,integer,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_setting_history(text,integer),juyu.read_setting_history_detail(text,uuid,integer),juyu.restore_setting(text,uuid,integer,integer,uuid) TO juyu_runtime;
