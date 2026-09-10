-- T052 fixed application features. Disabling retains all business data.
CREATE FUNCTION juyu.valid_feature_flags(flags jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN jsonb_typeof(flags)='object' THEN (SELECT count(*)=7 AND bool_and(key IN('search','pdfExport','favorites','recent','feedback','analytics','forms') AND jsonb_typeof(value)='boolean') FROM jsonb_each(flags)) ELSE false END
$$;
CREATE FUNCTION juyu.feature_config() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE s juyu.settings;config jsonb;
BEGIN
 SELECT * INTO s FROM juyu.settings WHERE key='feature-flags';
 IF NOT FOUND THEN RETURN jsonb_build_object('version',0,'flags','{"search":true,"pdfExport":true,"favorites":true,"recent":true,"feedback":true,"analytics":true,"forms":true}'::jsonb);END IF;
 SELECT v.config INTO config FROM juyu.setting_versions v WHERE v.setting_id=s.id AND v.version=s.current_version;
 IF s.kind<>'feature_flag' OR NOT s.enabled OR jsonb_typeof(config) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(config))<>1 OR NOT coalesce(juyu.valid_feature_flags(config->'flags'),false) THEN RAISE EXCEPTION 'INVALID_INPUT: feature config';END IF;
 RETURN config||jsonb_build_object('version',s.current_version);
END $$;
CREATE FUNCTION juyu.read_feature_config() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;RETURN juyu.feature_config();END $$;
CREATE FUNCTION juyu.read_feature_flags() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN IF NOT juyu.navigation_member_eligible() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;RETURN juyu.feature_config()->'flags';END $$;
CREATE FUNCTION juyu.require_feature(feature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF feature IS NULL OR feature NOT IN('search','pdfExport','favorites','recent','feedback','analytics','forms') THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT juyu.navigation_member_eligible() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620952) THEN RAISE EXCEPTION 'FEATURE_BUSY';END IF;
 IF NOT (juyu.feature_config()->'flags'->>feature)::boolean THEN RAISE EXCEPTION 'FEATURE_DISABLED';END IF;
END $$;
CREATE FUNCTION juyu.write_feature_config(p_expected integer,p_flags jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;setting juyu.settings;previous juyu.setting_versions;next_version integer;setting_id uuid;config jsonb;
BEGIN
 IF p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 OR NOT coalesce(juyu.valid_feature_flags(p_flags),false) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(84620952);PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 config:=jsonb_build_object('flags',p_flags);
 SELECT * INTO setting FROM juyu.settings WHERE key='feature-flags' FOR UPDATE;
 IF FOUND THEN
  IF setting.kind<>'feature_flag' OR NOT setting.enabled THEN RAISE EXCEPTION 'FEATURE_CONFLICT';END IF;
  SELECT * INTO previous FROM juyu.setting_versions v WHERE v.setting_id=setting.id AND v.version=setting.current_version;
  IF setting.current_version=p_expected+1 AND previous.changed_by=who AND previous.config=config THEN RETURN config||jsonb_build_object('version',setting.current_version);END IF;
  IF setting.current_version<>p_expected THEN RAISE EXCEPTION 'FEATURE_CONFLICT';END IF;setting_id:=setting.id;next_version:=setting.current_version+1;
 ELSE
  IF p_expected<>0 THEN RAISE EXCEPTION 'FEATURE_CONFLICT';END IF;setting_id:=gen_random_uuid();next_version:=1;
 END IF;
 IF next_version>=2147483647 THEN RAISE EXCEPTION 'FEATURE_CONFLICT';END IF;
 INSERT INTO juyu.settings(id,key,kind,current_version,enabled) VALUES(setting_id,'feature-flags','feature_flag',next_version,true) ON CONFLICT(id) DO UPDATE SET current_version=excluded.current_version;
 INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES(setting_id,next_version,config,who);
 RETURN config||jsonb_build_object('version',next_version);
END $$;

DROP POLICY settings_read ON juyu.settings;
CREATE POLICY settings_read ON juyu.settings FOR SELECT TO juyu_runtime USING(juyu.is_admin() AND (kind NOT IN('navigation','feature_flag') OR juyu.review_admin_eligible(juyu.actor_id())));
CREATE OR REPLACE FUNCTION juyu.setting_version_visible(p_setting uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT coalesce((SELECT juyu.is_admin() AND (s.kind NOT IN('navigation','feature_flag') OR juyu.review_admin_eligible(juyu.actor_id())) FROM juyu.settings s WHERE s.id=p_setting),false)
$$;
CREATE FUNCTION juyu.protect_feature_setting() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.key='feature-flags' AND (NEW.id,NEW.key,NEW.kind) IS DISTINCT FROM (OLD.id,OLD.key,OLD.kind) THEN RAISE EXCEPTION 'IMMUTABLE';END IF;
 IF NEW.key='feature-flags' AND (NEW.kind<>'feature_flag' OR NOT NEW.enabled) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;RETURN NEW;
END $$;
CREATE TRIGGER feature_setting_identity BEFORE INSERT OR UPDATE ON juyu.settings FOR EACH ROW EXECUTE FUNCTION juyu.protect_feature_setting();
REVOKE ALL ON FUNCTION juyu.valid_feature_flags(jsonb),juyu.feature_config(),juyu.read_feature_config(),juyu.read_feature_flags(),juyu.require_feature(text),juyu.write_feature_config(integer,jsonb),juyu.protect_feature_setting() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_feature_config(),juyu.read_feature_flags(),juyu.require_feature(text),juyu.write_feature_config(integer,jsonb) TO juyu_runtime;
