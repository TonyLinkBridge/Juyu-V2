-- Administrators may remove unused categories from the live taxonomy while the
-- immutable version history and category identity remain available for audit.
ALTER TABLE juyu.categories
 ADD COLUMN deleted_at timestamptz,
 ADD COLUMN deleted_by text REFERENCES juyu.members(clerk_user_id),
 ADD CONSTRAINT categories_deleted_together CHECK((deleted_at IS NULL)=(deleted_by IS NULL)),
 ADD CONSTRAINT categories_deleted_disabled CHECK(deleted_at IS NULL OR NOT enabled);
CREATE INDEX categories_active_parent_order ON juyu.categories(parent_id,position,id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION juyu.category_allowed(category uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 WITH RECURSIVE ancestors AS (
  SELECT c.id,c.parent_id,c.enabled,c.audience,ARRAY[c.id] AS path,false AS cycle
  FROM juyu.categories c WHERE c.id=category AND c.deleted_at IS NULL
  UNION ALL
  SELECT c.id,c.parent_id,c.enabled,c.audience,a.path||c.id,c.id=ANY(a.path)
  FROM juyu.categories c JOIN ancestors a ON c.id=a.parent_id
  WHERE c.deleted_at IS NULL AND NOT a.cycle
 )
 SELECT coalesce(bool_and(enabled AND juyu.audience_allowed(audience) AND NOT cycle) AND bool_or(parent_id IS NULL),false) FROM ancestors
$$;

CREATE OR REPLACE FUNCTION juyu.read_category_definitions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN (SELECT coalesce(jsonb_agg(juyu.category_config(c)||jsonb_build_object('id',c.id,'version',c.current_version) ORDER BY c.position,c.id),'[]') FROM juyu.categories c WHERE c.deleted_at IS NULL);
END $$;

CREATE OR REPLACE FUNCTION juyu.write_category_definition(p_id uuid,p_expected integer,p_config jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;saved_category juyu.categories;v juyu.category_versions;next_version integer;
BEGIN
 IF p_id IS NULL OR (p_expected IS NOT NULL AND (p_expected<1 OR p_expected>=2147483647)) OR NOT coalesce(juyu.valid_category_config(p_config),false) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(84620949);
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO saved_category FROM juyu.categories WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF saved_category.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CATEGORY_DELETED';END IF;
  SELECT * INTO v FROM juyu.category_versions WHERE category_id=p_id AND version=saved_category.current_version;
  IF saved_category.current_version=coalesce(p_expected,0)+1 AND v.changed_by=who AND v.config=p_config THEN RETURN v.config||jsonb_build_object('id',p_id,'version',saved_category.current_version);END IF;
  IF p_expected IS DISTINCT FROM saved_category.current_version THEN RAISE EXCEPTION 'CATEGORY_CONFLICT';END IF;
  next_version:=saved_category.current_version+1;IF next_version>=2147483647 THEN RAISE EXCEPTION 'CATEGORY_LIMIT';END IF;
 ELSE
  IF p_expected IS NOT NULL THEN RAISE EXCEPTION 'CATEGORY_CONFLICT';END IF;
  IF (SELECT count(*) FROM juyu.categories WHERE deleted_at IS NULL)>=100 THEN RAISE EXCEPTION 'CATEGORY_LIMIT';END IF;next_version:=1;
 END IF;
 IF p_config->'parentId'<>'null'::jsonb AND NOT EXISTS(SELECT 1 FROM juyu.categories WHERE id=(p_config->>'parentId')::uuid AND deleted_at IS NULL) THEN RAISE EXCEPTION 'INVALID_INPUT: unknown parent';END IF;
 IF p_config->>'parentId'=p_id::text THEN RAISE EXCEPTION 'CATEGORY_CYCLE';END IF;
 INSERT INTO juyu.categories(id,name,parent_id,position,audience,enabled,current_version) VALUES(p_id,p_config->>'name',(p_config->>'parentId')::uuid,(p_config->>'position')::integer,p_config->>'audience',(p_config->>'enabled')::boolean,next_version)
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,parent_id=excluded.parent_id,position=excluded.position,audience=excluded.audience,enabled=excluded.enabled,current_version=excluded.current_version;
 IF EXISTS(WITH RECURSIVE tree AS(SELECT id,parent_id,ARRAY[id] path,false cycle FROM juyu.categories WHERE deleted_at IS NULL UNION ALL SELECT c.id,c.parent_id,t.path||c.id,c.id=ANY(t.path) FROM tree t JOIN juyu.categories c ON c.id=t.parent_id WHERE c.deleted_at IS NULL AND NOT t.cycle AND cardinality(t.path)<=10) SELECT 1 FROM tree WHERE cycle) THEN RAISE EXCEPTION 'CATEGORY_CYCLE';END IF;
 IF EXISTS(WITH RECURSIVE tree AS(SELECT id,parent_id,1 depth FROM juyu.categories WHERE deleted_at IS NULL UNION ALL SELECT c.id,c.parent_id,t.depth+1 FROM tree t JOIN juyu.categories c ON c.id=t.parent_id WHERE c.deleted_at IS NULL AND t.depth<=10) SELECT 1 FROM tree WHERE depth>10) THEN RAISE EXCEPTION 'CATEGORY_DEPTH';END IF;
 RETURN p_config||jsonb_build_object('id',p_id,'version',next_version);
END $$;

CREATE FUNCTION juyu.delete_category_definition(p_id uuid,p_expected integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;saved juyu.categories;next_version integer;navigation_config jsonb;
BEGIN
 IF p_id IS NULL OR p_expected IS NULL OR p_expected<1 OR p_expected>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(84620949);
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO saved FROM juyu.categories WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CATEGORY_CONFLICT';END IF;
 IF saved.deleted_at IS NOT NULL THEN
  IF saved.current_version=p_expected+1 AND saved.deleted_by=who THEN RETURN jsonb_build_object('id',p_id,'version',saved.current_version,'deleted',true);END IF;
  RAISE EXCEPTION 'CATEGORY_CONFLICT';
 END IF;
 IF saved.current_version<>p_expected OR saved.current_version>=2147483646 THEN RAISE EXCEPTION 'CATEGORY_CONFLICT';END IF;
 IF EXISTS(SELECT 1 FROM juyu.categories WHERE parent_id=p_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'CATEGORY_HAS_CHILDREN';END IF;
 IF EXISTS(SELECT 1 FROM juyu.revision_categories WHERE category_id=p_id) THEN RAISE EXCEPTION 'CATEGORY_IN_USE';END IF;
 IF EXISTS(SELECT 1 FROM juyu.category_indexes WHERE category_id=p_id) THEN RAISE EXCEPTION 'CATEGORY_HAS_INDEX';END IF;
 SELECT v.config INTO navigation_config FROM juyu.settings s JOIN juyu.setting_versions v ON v.setting_id=s.id AND v.version=s.current_version WHERE s.key='reader-navigation';
 IF navigation_config IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(navigation_config->'entries') e WHERE e->'target'->>'type'='category' AND e->'target'->>'categoryId'=p_id::text) THEN RAISE EXCEPTION 'CATEGORY_IN_NAVIGATION';END IF;
 UPDATE juyu.categories SET enabled=false,deleted_at=clock_timestamp(),deleted_by=who WHERE id=p_id;
 next_version:=saved.current_version+1;
 RETURN jsonb_build_object('id',p_id,'version',next_version,'deleted',true);
END $$;

CREATE OR REPLACE FUNCTION juyu.guard_revision_categories() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
DECLARE prior uuid[];who text;d juyu.documents;
BEGIN
 IF current_user=(SELECT pg_get_userbyid(c.relowner) FROM pg_class c WHERE c.oid='juyu.revisions'::regclass) THEN NEW.category_binding_required:=false;RETURN NEW;END IF;
 NEW.category_binding_required:=true;
 IF cardinality(NEW.category_ids)>20 OR array_ndims(NEW.category_ids)>1 OR EXISTS(SELECT 1 FROM unnest(NEW.category_ids) id WHERE id IS NULL) OR cardinality(NEW.category_ids)<>(SELECT count(DISTINCT id) FROM unnest(NEW.category_ids) id) THEN RAISE EXCEPTION 'INVALID_INPUT: category IDs';END IF;
 SELECT * INTO d FROM juyu.documents WHERE id=NEW.document_id FOR UPDATE;
 SELECT coalesce(array_agg(rc.category_id ORDER BY rc.category_id),'{}') INTO prior FROM juyu.revision_categories rc WHERE rc.document_id=NEW.document_id AND rc.revision_id=d.workflow_revision_id;
 IF cardinality(NEW.category_ids)=0 AND cardinality(prior)=0 THEN RETURN NEW;END IF;
 who:=juyu.actor_id();PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 PERFORM pg_advisory_xact_lock_shared(84620949);
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) OR who IS DISTINCT FROM NEW.editor_id THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF d.lifecycle<>'active' OR d.workflow_state='in_review' OR NEW.revision_id<>coalesce((SELECT max(revision_id)+1 FROM juyu.revisions WHERE document_id=NEW.document_id),1) THEN RAISE EXCEPTION 'INVALID_STATE';END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.category_ids) candidate(id) WHERE NOT EXISTS(SELECT 1 FROM juyu.categories c WHERE c.id=candidate.id AND c.deleted_at IS NULL)) THEN RAISE EXCEPTION 'INVALID_INPUT: unknown category';END IF;
 IF EXISTS(WITH RECURSIVE ancestors AS(SELECT c.id,c.parent_id,c.enabled,ARRAY[c.id] path FROM juyu.categories c WHERE c.id=ANY(NEW.category_ids) AND c.deleted_at IS NULL AND NOT c.id=ANY(prior) UNION ALL SELECT c.id,c.parent_id,c.enabled,a.path||c.id FROM ancestors a JOIN juyu.categories c ON c.id=a.parent_id WHERE c.deleted_at IS NULL AND NOT c.id=ANY(a.path) AND cardinality(a.path)<=10) SELECT 1 FROM ancestors WHERE NOT enabled OR cardinality(path)>10) THEN RAISE EXCEPTION 'INVALID_INPUT: disabled category';END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION juyu.write_navigation_settings(p_expected integer,p_entries jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
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
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_entries) e WHERE e->'target'->>'type'='category' AND NOT EXISTS(SELECT 1 FROM juyu.categories c WHERE c.id::text=e->'target'->>'categoryId' AND c.deleted_at IS NULL)) THEN RAISE EXCEPTION 'INVALID_INPUT: unknown category';END IF;
 INSERT INTO juyu.settings(id,key,kind,current_version,enabled) VALUES(setting_id,'reader-navigation','navigation',next_version,true) ON CONFLICT(id) DO UPDATE SET current_version=excluded.current_version;
 INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES(setting_id,next_version,config,who);
 RETURN config||jsonb_build_object('version',next_version);
END $$;

REVOKE ALL ON FUNCTION juyu.delete_category_definition(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.delete_category_definition(uuid,integer) TO juyu_runtime;
