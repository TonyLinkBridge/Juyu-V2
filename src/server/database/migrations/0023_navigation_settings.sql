-- A single immutable-version setting controls shortcuts; destination authorization remains separate.
CREATE FUNCTION juyu.valid_navigation_entries(p_entries jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE entry jsonb;target jsonb;label text;role jsonb;canonical jsonb;
BEGIN
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries)>40 THEN RETURN false;END IF;
 FOR entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
  IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(entry))<>5 OR NOT entry ?& ARRAY['id','label','enabled','roles','target'] OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string' OR entry->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR jsonb_typeof(entry->'label') IS DISTINCT FROM 'string' OR jsonb_typeof(entry->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(entry->'roles') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
  label:=entry->>'label';IF char_length(label) NOT BETWEEN 1 AND 80 OR label<>btrim(label,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') OR label ~ '[[:cntrl:]]' OR label ~ U&'[\0080-\009F]' OR jsonb_array_length(entry->'roles') NOT BETWEEN 1 AND 3 THEN RETURN false;END IF;
  FOR role IN SELECT * FROM jsonb_array_elements(entry->'roles') LOOP IF jsonb_typeof(role)<>'string' OR role#>>'{}' NOT IN('support','ops','admin') THEN RETURN false;END IF;END LOOP;
  SELECT jsonb_agg(to_jsonb(r) ORDER BY position) INTO canonical FROM unnest(ARRAY['support','ops','admin']) WITH ORDINALITY AS list(r,position) WHERE entry->'roles' @> jsonb_build_array(r);IF canonical IS DISTINCT FROM entry->'roles' THEN RETURN false;END IF;
  target:=entry->'target';IF jsonb_typeof(target) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(target))<>2 THEN RETURN false;END IF;
  IF target->>'type'='page' THEN IF NOT target ?& ARRAY['type','page'] OR jsonb_typeof(target->'page') IS DISTINCT FROM 'string' OR target->>'page' NOT IN('home','ops','reference','qa','favorites','recent','forms') THEN RETURN false;END IF;
  ELSIF target->>'type'='category' THEN IF NOT target ?& ARRAY['type','categoryId'] OR jsonb_typeof(target->'categoryId') IS DISTINCT FROM 'string' OR target->>'categoryId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false;END IF;
  ELSE RETURN false;END IF;
 END LOOP;
 RETURN (SELECT count(DISTINCT e->>'id')=count(*) FROM jsonb_array_elements(p_entries) e);
END $$;
CREATE FUNCTION juyu.default_navigation_entries() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_agg(jsonb_build_object('id','00000000-0000-4000-8000-'||lpad(position::text,12,'0'),'label',label,'enabled',true,'roles',CASE WHEN page='ops' THEN '["ops","admin"]'::jsonb ELSE '["support","ops","admin"]'::jsonb END,'target',jsonb_build_object('type','page','page',page)) ORDER BY position)
 FROM(VALUES(1,'home','帮助中心'),(2,'ops','OPS Internal'),(3,'reference','Reference 速查'),(4,'qa','Q&A 问答'),(5,'favorites','我的收藏'),(6,'recent','最近浏览'),(7,'forms','内部表单')) AS defaults(position,page,label)
$$;
CREATE FUNCTION juyu.navigation_member_eligible() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL)
$$;
CREATE FUNCTION juyu.navigation_config() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE setting juyu.settings;config jsonb;
BEGIN
 SELECT * INTO setting FROM juyu.settings WHERE key='reader-navigation';IF NOT FOUND THEN RETURN jsonb_build_object('version',0,'entries',juyu.default_navigation_entries());END IF;
 SELECT v.config INTO config FROM juyu.setting_versions v WHERE v.setting_id=setting.id AND v.version=setting.current_version;
 IF setting.kind<>'navigation' OR NOT setting.enabled OR setting.current_version>=2147483647 OR jsonb_typeof(config) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(config))<>1 OR NOT coalesce(juyu.valid_navigation_entries(config->'entries'),false) THEN RAISE EXCEPTION 'INVALID_INPUT: navigation configuration';END IF;
 RETURN config||jsonb_build_object('version',setting.current_version);
END $$;
CREATE FUNCTION juyu.read_navigation_settings() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;RETURN juyu.navigation_config();END $$;
CREATE FUNCTION juyu.write_navigation_settings(p_expected integer,p_entries jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;setting juyu.settings;previous juyu.setting_versions;next_version integer;setting_id uuid;config jsonb;
BEGIN
 IF p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 OR NOT coalesce(juyu.valid_navigation_entries(p_entries),false) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(84620951);PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 config:=jsonb_build_object('entries',p_entries);
 SELECT * INTO setting FROM juyu.settings WHERE key='reader-navigation' FOR UPDATE;
 IF FOUND THEN
  IF setting.kind<>'navigation' OR NOT setting.enabled THEN RAISE EXCEPTION 'NAVIGATION_CONFLICT';END IF;
  SELECT * INTO previous FROM juyu.setting_versions v WHERE v.setting_id=setting.id AND v.version=setting.current_version;
  IF setting.current_version=p_expected+1 AND previous.changed_by=who AND previous.config=config THEN RETURN config||jsonb_build_object('version',setting.current_version);END IF;
  IF setting.current_version<>p_expected THEN RAISE EXCEPTION 'NAVIGATION_CONFLICT';END IF;setting_id:=setting.id;next_version:=setting.current_version+1;
 ELSE
  IF p_expected<>0 THEN RAISE EXCEPTION 'NAVIGATION_CONFLICT';END IF;setting_id:=gen_random_uuid();next_version:=1;
 END IF;
 IF next_version>=2147483647 THEN RAISE EXCEPTION 'NAVIGATION_LIMIT';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_entries) e WHERE e->'target'->>'type'='category' AND NOT EXISTS(SELECT 1 FROM juyu.categories c WHERE c.id::text=e->'target'->>'categoryId')) THEN RAISE EXCEPTION 'INVALID_INPUT: unknown category';END IF;
 INSERT INTO juyu.settings(id,key,kind,current_version,enabled) VALUES(setting_id,'reader-navigation','navigation',next_version,true) ON CONFLICT(id) DO UPDATE SET current_version=excluded.current_version;
 INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES(setting_id,next_version,config,who);
 RETURN config||jsonb_build_object('version',next_version);
END $$;
CREATE FUNCTION juyu.navigation_category_allowed(p_category uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT juyu.category_allowed(p_category) AND EXISTS(
  WITH RECURSIVE descendants AS(SELECT c.id,ARRAY[c.id] path FROM juyu.categories c WHERE c.id=p_category UNION ALL SELECT c.id,d.path||c.id FROM juyu.categories c JOIN descendants d ON c.parent_id=d.id WHERE NOT c.id=ANY(d.path) AND cardinality(d.path)<10)
  SELECT 1 FROM descendants c JOIN juyu.revision_categories rc ON rc.category_id=c.id WHERE juyu.can_read_revision(rc.document_id,rc.revision_id)
 )
$$;
CREATE FUNCTION juyu.read_reader_menu() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE role text;config jsonb;
BEGIN
 IF NOT juyu.navigation_member_eligible() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;SELECT i.role INTO role FROM juyu.current_identity() i;config:=juyu.navigation_config();
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',e->'id','label',e->'label','href',CASE WHEN e->'target'->>'type'='category' THEN '/help-centre/categories/'||(e->'target'->>'categoryId') WHEN e->'target'->>'page'='home' THEN '/help-centre' ELSE '/help-centre/'||(e->'target'->>'page') END) ORDER BY position),'[]') FROM jsonb_array_elements(config->'entries') WITH ORDINALITY AS entries(e,position)
 WHERE (e->>'enabled')::boolean AND e->'roles' @> jsonb_build_array(role) AND CASE WHEN e->'target'->>'type'='category' THEN juyu.navigation_category_allowed((e->'target'->>'categoryId')::uuid) ELSE e->'target'->>'page'<>'ops' OR role IN('ops','admin') END);
END $$;
-- Raw runtime reads of navigation configuration also require a currently eligible Admin.
DROP POLICY settings_read ON juyu.settings;
CREATE POLICY settings_read ON juyu.settings FOR SELECT TO juyu_runtime USING(juyu.is_admin() AND (kind<>'navigation' OR juyu.review_admin_eligible(juyu.actor_id())));
CREATE FUNCTION juyu.setting_version_visible(p_setting uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT coalesce((SELECT juyu.is_admin() AND (s.kind<>'navigation' OR juyu.review_admin_eligible(juyu.actor_id())) FROM juyu.settings s WHERE s.id=p_setting),false)
$$;
DROP POLICY setting_versions_read ON juyu.setting_versions;
CREATE POLICY setting_versions_read ON juyu.setting_versions FOR SELECT TO juyu_runtime USING(juyu.setting_version_visible(setting_id));
CREATE FUNCTION juyu.protect_navigation_setting() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.key='reader-navigation' AND (NEW.id,NEW.key,NEW.kind) IS DISTINCT FROM (OLD.id,OLD.key,OLD.kind) THEN RAISE EXCEPTION 'IMMUTABLE: navigation identity';END IF;
 IF NEW.key='reader-navigation' AND (NEW.kind<>'navigation' OR NOT NEW.enabled) THEN RAISE EXCEPTION 'INVALID_INPUT: navigation setting';END IF;RETURN NEW;
END $$;
CREATE TRIGGER navigation_setting_identity BEFORE INSERT OR UPDATE ON juyu.settings FOR EACH ROW EXECUTE FUNCTION juyu.protect_navigation_setting();
REVOKE ALL ON FUNCTION juyu.valid_navigation_entries(jsonb),juyu.default_navigation_entries(),juyu.navigation_member_eligible(),juyu.navigation_config(),juyu.read_navigation_settings(),juyu.write_navigation_settings(integer,jsonb),juyu.navigation_category_allowed(uuid),juyu.read_reader_menu(),juyu.setting_version_visible(uuid),juyu.protect_navigation_setting() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_navigation_settings(),juyu.write_navigation_settings(integer,jsonb),juyu.read_reader_menu(),juyu.setting_version_visible(uuid) TO juyu_runtime;
