-- Field definitions are versioned configuration; field values belong to immutable revisions.
CREATE FUNCTION juyu.valid_field_config(config jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE option jsonb; label text;
BEGIN
 IF jsonb_typeof(config) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(config))<>5
 OR NOT config ?& ARRAY['name','type','required','enabled','options']
 OR jsonb_typeof(config->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(config->'type') IS DISTINCT FROM 'string'
 OR jsonb_typeof(config->'required') IS DISTINCT FROM 'boolean' OR jsonb_typeof(config->'enabled') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(config->'options') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 label:=config->>'name';
 IF char_length(label) NOT BETWEEN 1 AND 80 OR label<>btrim(label,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') OR label ~ '[[:cntrl:]]' OR config->>'type' NOT IN('text','number','date','select','boolean') THEN RETURN false; END IF;
 IF config->>'type'='select' THEN
  IF jsonb_array_length(config->'options') NOT BETWEEN 1 AND 30 THEN RETURN false; END IF;
  FOR option IN SELECT * FROM jsonb_array_elements(config->'options') LOOP
   label:=option#>>'{}';IF jsonb_typeof(option)<>'string' OR char_length(label) NOT BETWEEN 1 AND 80 OR label<>btrim(label,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') OR label ~ '[[:cntrl:]]' THEN RETURN false;END IF;
  END LOOP;
  IF (SELECT count(DISTINCT x)<>count(*) FROM jsonb_array_elements(config->'options') x) THEN RETURN false;END IF;
 ELSE IF jsonb_array_length(config->'options')<>0 THEN RETURN false;END IF;
 END IF;RETURN true;
END $$;
CREATE FUNCTION juyu.valid_field_snapshots(fields jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE field jsonb;kind text;
BEGIN
 IF jsonb_typeof(fields) IS DISTINCT FROM 'array' OR jsonb_array_length(fields)>30 THEN RETURN false; END IF;
 FOR field IN SELECT * FROM jsonb_array_elements(fields) LOOP
  IF jsonb_typeof(field) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(field))<>8
  OR NOT field ?& ARRAY['id','version','name','type','required','enabled','options','value']
  OR jsonb_typeof(field->'id') IS DISTINCT FROM 'string' OR field->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR jsonb_typeof(field->'version') IS DISTINCT FROM 'number' OR field->>'version' !~ '^[1-9][0-9]*$'
  OR (field->>'version')::numeric>=2147483647 OR NOT juyu.valid_field_config(field-ARRAY['id','version','value']) THEN RETURN false;END IF;
  kind:=jsonb_typeof(field->'value');IF kind='null' THEN CONTINUE;END IF;
  IF field->>'type'='number' THEN IF kind<>'number' OR abs((field->>'value')::numeric)>1.7976931348623157e308 THEN RETURN false; END IF;
  ELSIF field->>'type'='boolean' THEN IF kind<>'boolean' THEN RETURN false; END IF;
  ELSE IF kind<>'string' OR char_length(field->>'value')>2000 THEN RETURN false; END IF;END IF;
 END LOOP;
 RETURN (SELECT count(DISTINCT x->>'id')=count(*) FROM jsonb_array_elements(fields) x);
END $$;
ALTER TABLE juyu.revisions ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '[]' CHECK(juyu.valid_field_snapshots(custom_fields));
CREATE FUNCTION juyu.read_field_definitions() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(v.config||jsonb_build_object('id',s.id,'version',s.current_version) ORDER BY s.id),'[]') FROM juyu.settings s JOIN juyu.setting_versions v ON v.setting_id=s.id AND v.version=s.current_version WHERE s.kind='field');
END $$;
CREATE FUNCTION juyu.write_field_definition(p_id uuid,p_expected integer,p_config jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;s juyu.settings;v juyu.setting_versions;next_version integer;
BEGIN
 IF p_id IS NULL OR (p_expected IS NOT NULL AND (p_expected<1 OR p_expected>=2147483647)) OR NOT coalesce(juyu.valid_field_config(p_config),false) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY'; END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(84620948);
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO s FROM juyu.settings WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF s.kind<>'field' OR s.key<>'field-'||p_id::text THEN RAISE EXCEPTION 'FIELD_CONFLICT';END IF;
  SELECT * INTO v FROM juyu.setting_versions WHERE setting_id=p_id AND version=s.current_version;
  IF s.current_version=coalesce(p_expected,0)+1 AND v.changed_by=who AND v.config=p_config THEN RETURN v.config||jsonb_build_object('id',p_id,'version',s.current_version);END IF;
  IF p_expected IS DISTINCT FROM s.current_version THEN RAISE EXCEPTION 'FIELD_CONFLICT';END IF;
  IF v.config->>'type' IS DISTINCT FROM p_config->>'type' THEN RAISE EXCEPTION 'INVALID_INPUT: field type is immutable';END IF;
  next_version:=s.current_version+1;IF next_version>=2147483647 THEN RAISE EXCEPTION 'FIELD_LIMIT';END IF;
 ELSE
  IF p_expected IS NOT NULL THEN RAISE EXCEPTION 'FIELD_CONFLICT';END IF;
  IF (SELECT count(*) FROM juyu.settings WHERE kind='field')>=30 THEN RAISE EXCEPTION 'FIELD_LIMIT';END IF;
  next_version:=1;
  INSERT INTO juyu.settings(id,key,kind,current_version,enabled) VALUES(p_id,'field-'||p_id::text,'field',1,(p_config->>'enabled')::boolean);
 END IF;
 INSERT INTO juyu.setting_versions(setting_id,version,config,changed_by) VALUES(p_id,next_version,p_config,who);
 UPDATE juyu.settings SET current_version=next_version,enabled=(p_config->>'enabled')::boolean WHERE id=p_id;
 RETURN p_config||jsonb_build_object('id',p_id,'version',next_version);
END $$;
-- Existing generic setting kinds retain their contracts. Runtime has no direct
-- settings write grants; only the validated field operation may change fields.
CREATE FUNCTION juyu.protect_field_setting() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NEW.kind='field' AND NEW.key<>'field-'||NEW.id::text THEN RAISE EXCEPTION 'INVALID_INPUT: field key';END IF;
 IF TG_OP='UPDATE' AND OLD.kind='field' AND (NEW.id,NEW.key,NEW.kind) IS DISTINCT FROM (OLD.id,OLD.key,OLD.kind) THEN RAISE EXCEPTION 'IMMUTABLE: field identity';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER field_setting_identity BEFORE INSERT OR UPDATE ON juyu.settings FOR EACH ROW EXECUTE FUNCTION juyu.protect_field_setting();
CREATE FUNCTION juyu.check_field_setting() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
DECLARE s juyu.settings;v juyu.setting_versions;
BEGIN
 IF TG_TABLE_NAME='settings' THEN SELECT * INTO s FROM juyu.settings WHERE id=NEW.id; ELSE SELECT * INTO s FROM juyu.settings WHERE id=NEW.setting_id; END IF;
 IF s.kind='field' THEN
  SELECT * INTO v FROM juyu.setting_versions WHERE setting_id=s.id AND version=s.current_version;
  IF NOT FOUND OR NOT juyu.valid_field_config(v.config) OR s.enabled IS DISTINCT FROM (v.config->>'enabled')::boolean
   OR EXISTS(SELECT 1 FROM juyu.setting_versions prior WHERE prior.setting_id=s.id AND (NOT juyu.valid_field_config(prior.config) OR prior.config->>'type' IS DISTINCT FROM v.config->>'type')) THEN RAISE EXCEPTION 'INVALID_INPUT: field configuration';END IF;
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER field_setting_config AFTER INSERT OR UPDATE ON juyu.settings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION juyu.check_field_setting();
CREATE CONSTRAINT TRIGGER field_version_config AFTER INSERT ON juyu.setting_versions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION juyu.check_field_setting();
CREATE FUNCTION juyu.read_publication_fields(p_document text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT r.custom_fields FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id WHERE d.id=p_document AND juyu.can_read_revision(r.document_id,r.revision_id)
$$;
REVOKE ALL ON FUNCTION juyu.valid_field_config(jsonb),juyu.valid_field_snapshots(jsonb),juyu.read_field_definitions(),juyu.write_field_definition(uuid,integer,jsonb),juyu.protect_field_setting(),juyu.check_field_setting(),juyu.read_publication_fields(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.valid_field_snapshots(jsonb),juyu.valid_field_config(jsonb),juyu.read_field_definitions(),juyu.write_field_definition(uuid,integer,jsonb),juyu.read_publication_fields(text) TO juyu_runtime;

-- Restoration deliberately copies historical definitions and values without current-config validation.
CREATE OR REPLACE FUNCTION juyu.restore_document_version(p_document text,p_source integer,p_expected integer)
RETURNS TABLE(document_id text,sequence integer,revision integer,source_revision integer,status text,published_revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE d juyu.documents;source juyu.revisions;who text;next_revision integer;stamp timestamptz;
BEGIN
 IF p_document IS NULL OR btrim(p_document)='' OR p_document<>btrim(p_document) OR char_length(p_document)>200 OR p_source IS NULL OR p_source<1 OR p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY'; END IF;
 who:=juyu.actor_id();
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('editor:'||p_document,0));
 SELECT * INTO d FROM juyu.documents WHERE id=p_document FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who ORDER BY clerk_user_id FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 -- Only the latest immutable evidence may acknowledge an exact retry.
 IF d.sequence=p_expected+1 AND d.lifecycle='active' AND d.workflow_state='draft'
  AND d.submitted_by IS NULL AND d.reviewer_id IS NULL AND d.approved_by IS NULL
  AND NOT EXISTS(SELECT 1 FROM juyu.reviews r WHERE r.document_id=p_document AND r.status='in_review')
  AND (SELECT a.sequence=d.sequence AND a.action='restore_version' AND a.actor_id=who AND a.revision_id=d.workflow_revision_id AND a.source_revision_id=p_source AND a.previous_published_revision_id IS NOT DISTINCT FROM d.published_revision_id FROM juyu.audit_log a WHERE a.document_id=p_document ORDER BY a.sequence DESC LIMIT 1)
  AND EXISTS(SELECT 1 FROM juyu.revisions r WHERE r.document_id=p_document AND r.revision_id=d.workflow_revision_id AND r.editor_id=who) THEN
  RETURN QUERY SELECT p_document,d.sequence,d.workflow_revision_id,p_source,'draft'::text,d.published_revision_id;RETURN;
 END IF;
 IF d.sequence<>p_expected THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF d.lifecycle<>'active' OR d.workflow_state='in_review' OR p_source>=d.workflow_revision_id OR EXISTS(SELECT 1 FROM juyu.reviews r WHERE r.document_id=p_document AND r.status='in_review') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 SELECT * INTO source FROM juyu.revisions r WHERE r.document_id=p_document AND r.revision_id=p_source;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM juyu.assets a WHERE a.document_id=p_document AND a.status='pending') THEN RAISE EXCEPTION 'UPLOAD_IN_PROGRESS'; END IF;
 -- Lock every source file, including attachments absent from visible media blocks.
 PERFORM a.id FROM juyu.assets a WHERE a.document_id=p_document AND EXISTS(SELECT 1 FROM juyu.revision_assets ra WHERE ra.document_id=p_document AND ra.revision_id=p_source AND ra.asset_id=a.id) ORDER BY a.id FOR SHARE;
 IF EXISTS(SELECT 1 FROM juyu.revision_assets ra LEFT JOIN juyu.assets a ON a.id=ra.asset_id AND a.document_id=ra.document_id WHERE ra.document_id=p_document AND ra.revision_id=p_source AND (a.id IS NULL OR a.status<>'ready'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(source.content_blocks) block WHERE block ? 'assetId' AND NOT EXISTS(SELECT 1 FROM juyu.revision_assets ra JOIN juyu.assets a ON a.id=ra.asset_id AND a.document_id=ra.document_id WHERE ra.document_id=p_document AND ra.revision_id=p_source AND ra.asset_id::text=block->>'assetId' AND a.status='ready')) THEN RAISE EXCEPTION 'INVALID_MEDIA'; END IF;
 SELECT max(r.revision_id) INTO next_revision FROM juyu.revisions r WHERE r.document_id=p_document;
 IF next_revision<>d.workflow_revision_id OR next_revision>=2147483647 THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 next_revision:=next_revision+1;stamp:=clock_timestamp();
 INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,tags,cover_alt,cover_position,content_blocks,qa_category,qa_position,custom_fields)
 VALUES(p_document,next_revision,source.title,source.body,source.audience,source.author_id,who,stamp,source.tags,source.cover_alt,source.cover_position,source.content_blocks,source.qa_category,source.qa_position,source.custom_fields);
 INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) SELECT p_document,next_revision,rc.category_id FROM juyu.revision_categories rc WHERE rc.document_id=p_document AND rc.revision_id=p_source;
 INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) SELECT p_document,next_revision,ra.asset_id,ra.usage FROM juyu.revision_assets ra WHERE ra.document_id=p_document AND ra.revision_id=p_source;
 UPDATE juyu.documents SET sequence=d.sequence+1,workflow_revision_id=next_revision,workflow_state='draft',submitted_by=NULL,reviewer_id=NULL,approved_by=NULL,updated_at=stamp WHERE id=p_document;
 INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,source_revision_id,previous_published_revision_id,at) VALUES(p_document,d.sequence+1,'restore_version',who,next_revision,p_source,d.published_revision_id,stamp);
 RETURN QUERY SELECT p_document,d.sequence+1,next_revision,p_source,'draft'::text,d.published_revision_id;
END $$;
REVOKE ALL ON FUNCTION juyu.restore_document_version(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.restore_document_version(text,integer,integer) TO juyu_runtime;

-- Calendar dates and whitespace use the same rules as the shared editor model.
CREATE FUNCTION juyu.valid_field_date(value text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR left(value,4)='0000' THEN RETURN false;END IF;
 RETURN to_char(make_date(left(value,4)::integer,substring(value,6,2)::integer,right(value,2)::integer),'YYYY-MM-DD')=value;
EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format OR invalid_text_representation THEN RETURN false;
END $$;
CREATE FUNCTION juyu.guard_revision_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
DECLARE previous jsonb;definition jsonb;field jsonb;saved jsonb;who text;blank boolean;
BEGIN
 -- A SECURITY DEFINER restore runs as the actual table owner. Runtime cannot
 -- impersonate that role or toggle this trusted bypass with a session setting.
 IF current_user=(SELECT pg_get_userbyid(c.relowner) FROM pg_class c WHERE c.oid='juyu.revisions'::regclass) THEN RETURN NEW;END IF;
 IF NOT juyu.valid_field_snapshots(NEW.custom_fields) THEN RAISE EXCEPTION 'INVALID_INPUT: field snapshots';END IF;
 -- Match repository ordering: document, member, then global field config lock.
 PERFORM id FROM juyu.documents WHERE id=NEW.document_id FOR UPDATE;
 who:=juyu.actor_id();PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 PERFORM pg_advisory_xact_lock(84620948);
 IF NOT EXISTS(SELECT 1 FROM juyu.settings WHERE kind='field') AND NEW.custom_fields='[]'::jsonb THEN RETURN NEW;END IF;
 IF NOT juyu.is_admin() OR who IS DISTINCT FROM NEW.editor_id OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT r.custom_fields INTO previous FROM juyu.revisions r WHERE r.document_id=NEW.document_id ORDER BY r.revision_id DESC LIMIT 1;
 previous:=coalesce(previous,'[]');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.custom_fields) f WHERE NOT EXISTS(SELECT 1 FROM juyu.settings s WHERE s.kind='field' AND s.id::text=f->>'id')) THEN RAISE EXCEPTION 'INVALID_INPUT: unknown field';END IF;
 FOR definition IN SELECT v.config||jsonb_build_object('id',s.id,'version',s.current_version) FROM juyu.settings s JOIN juyu.setting_versions v ON v.setting_id=s.id AND v.version=s.current_version WHERE s.kind='field' ORDER BY s.id LOOP
  SELECT f INTO field FROM jsonb_array_elements(NEW.custom_fields) f WHERE f->>'id'=definition->>'id';
  SELECT f INTO saved FROM jsonb_array_elements(previous) f WHERE f->>'id'=definition->>'id';
  IF NOT (definition->>'enabled')::boolean THEN
   IF field IS DISTINCT FROM saved THEN RAISE EXCEPTION 'INVALID_INPUT: disabled field must be preserved';END IF;
   CONTINUE;
  END IF;
  IF field IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT: missing field';END IF;
  IF field->'version' IS DISTINCT FROM definition->'version' THEN RAISE EXCEPTION 'FIELD_CONFLICT';END IF;
  IF field-'value' IS DISTINCT FROM definition THEN RAISE EXCEPTION 'INVALID_INPUT: field metadata';END IF;
  blank:=field->'value'='null'::jsonb OR (jsonb_typeof(field->'value')='string' AND btrim(field->>'value',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')='');
  IF blank THEN
   IF (definition->>'required')::boolean OR field->'value'<>'null'::jsonb THEN RAISE EXCEPTION 'INVALID_INPUT: required field';END IF;
  ELSIF definition->>'type'='select' AND NOT (definition->'options' @> jsonb_build_array(field->'value')) THEN RAISE EXCEPTION 'INVALID_INPUT: select option';
  ELSIF definition->>'type'='date' AND NOT juyu.valid_field_date(field->>'value') THEN RAISE EXCEPTION 'INVALID_INPUT: calendar date';END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER revision_fields BEFORE INSERT ON juyu.revisions FOR EACH ROW EXECUTE FUNCTION juyu.guard_revision_fields();
REVOKE ALL ON FUNCTION juyu.valid_field_date(text),juyu.guard_revision_fields() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.valid_field_date(text) TO juyu_runtime;
