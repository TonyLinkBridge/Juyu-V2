-- Stable category identities carry current policy; membership is immutable per revision.
ALTER TABLE juyu.categories ADD COLUMN current_version integer NOT NULL DEFAULT 1 CHECK(current_version BETWEEN 1 AND 2147483646);
CREATE TABLE juyu.category_versions(
 category_id uuid NOT NULL REFERENCES juyu.categories(id),version integer NOT NULL,
 config jsonb NOT NULL,changed_by text REFERENCES juyu.members(clerk_user_id),changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(category_id,version)
);
ALTER TABLE juyu.category_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.category_versions FORCE ROW LEVEL SECURITY;
CREATE FUNCTION juyu.category_config(c juyu.categories) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
 SELECT jsonb_build_object('name',c.name,'parentId',c.parent_id,'position',c.position,'audience',c.audience,'enabled',c.enabled)
$$;
INSERT INTO juyu.category_versions(category_id,version,config) SELECT id,1,juyu.category_config(c) FROM juyu.categories c;
CREATE FUNCTION juyu.valid_category_config(config jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE label text;
BEGIN
 IF jsonb_typeof(config) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(config))<>5 OR NOT config ?& ARRAY['name','parentId','position','audience','enabled'] THEN RETURN false;END IF;
 IF jsonb_typeof(config->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(config->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(config->'audience') IS DISTINCT FROM 'string' OR config->>'audience' NOT IN('staff','ops','admin') OR jsonb_typeof(config->'position') IS DISTINCT FROM 'number' OR config->>'position' !~ '^(0|[1-9][0-9]{0,5})$' OR (config->'parentId'<>'null'::jsonb AND (jsonb_typeof(config->'parentId') IS DISTINCT FROM 'string' OR config->>'parentId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) THEN RETURN false;END IF;
 label:=config->>'name';RETURN char_length(label) BETWEEN 1 AND 120 AND label=btrim(label,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') AND label !~ '[[:cntrl:]]' AND label !~ U&'[\0080-\009F]';
END $$;
CREATE FUNCTION juyu.audit_category_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 INSERT INTO juyu.category_versions(category_id,version,config,changed_by) VALUES(NEW.id,NEW.current_version,juyu.category_config(NEW),juyu.actor_id());RETURN NEW;
END $$;
CREATE FUNCTION juyu.protect_category_history() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE: category history';END $$;
CREATE TRIGGER category_history_immutable BEFORE UPDATE OR DELETE ON juyu.category_versions FOR EACH ROW EXECUTE FUNCTION juyu.protect_category_history();
CREATE TRIGGER category_no_delete BEFORE DELETE ON juyu.categories FOR EACH ROW EXECUTE FUNCTION juyu.protect_category_history();
CREATE FUNCTION juyu.advance_category_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'IMMUTABLE: category identity';END IF;NEW.current_version:=OLD.current_version+1;RETURN NEW;END $$;
CREATE TRIGGER category_version BEFORE UPDATE ON juyu.categories FOR EACH ROW EXECUTE FUNCTION juyu.advance_category_version();
REVOKE ALL ON FUNCTION juyu.advance_category_version() FROM PUBLIC;
CREATE TRIGGER category_audit AFTER INSERT OR UPDATE ON juyu.categories FOR EACH ROW EXECUTE FUNCTION juyu.audit_category_change();
CREATE FUNCTION juyu.read_category_definitions() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN (SELECT coalesce(jsonb_agg(juyu.category_config(c)||jsonb_build_object('id',c.id,'version',c.current_version) ORDER BY c.position,c.id),'[]') FROM juyu.categories c);
END $$;
CREATE FUNCTION juyu.write_category_definition(p_id uuid,p_expected integer,p_config jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
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
  SELECT * INTO v FROM juyu.category_versions WHERE category_id=p_id AND version=saved_category.current_version;
  IF saved_category.current_version=coalesce(p_expected,0)+1 AND v.changed_by=who AND v.config=p_config THEN RETURN v.config||jsonb_build_object('id',p_id,'version',saved_category.current_version);END IF;
  IF p_expected IS DISTINCT FROM saved_category.current_version THEN RAISE EXCEPTION 'CATEGORY_CONFLICT';END IF;
  next_version:=saved_category.current_version+1;IF next_version>=2147483647 THEN RAISE EXCEPTION 'CATEGORY_LIMIT';END IF;
 ELSE
  IF p_expected IS NOT NULL THEN RAISE EXCEPTION 'CATEGORY_CONFLICT';END IF;
  IF (SELECT count(*) FROM juyu.categories)>=100 THEN RAISE EXCEPTION 'CATEGORY_LIMIT';END IF;next_version:=1;
 END IF;
 IF p_config->'parentId'<>'null'::jsonb AND NOT EXISTS(SELECT 1 FROM juyu.categories WHERE id=(p_config->>'parentId')::uuid) THEN RAISE EXCEPTION 'INVALID_INPUT: unknown parent';END IF;
 IF p_config->>'parentId'=p_id::text THEN RAISE EXCEPTION 'CATEGORY_CYCLE';END IF;
 INSERT INTO juyu.categories(id,name,parent_id,position,audience,enabled,current_version) VALUES(p_id,p_config->>'name',(p_config->>'parentId')::uuid,(p_config->>'position')::integer,p_config->>'audience',(p_config->>'enabled')::boolean,next_version)
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,parent_id=excluded.parent_id,position=excluded.position,audience=excluded.audience,enabled=excluded.enabled,current_version=excluded.current_version;
 IF EXISTS(WITH RECURSIVE tree AS(SELECT id,parent_id,ARRAY[id] path,false cycle FROM juyu.categories UNION ALL SELECT c.id,c.parent_id,t.path||c.id,c.id=ANY(t.path) FROM tree t JOIN juyu.categories c ON c.id=t.parent_id WHERE NOT t.cycle AND cardinality(t.path)<=10) SELECT 1 FROM tree WHERE cycle) THEN RAISE EXCEPTION 'CATEGORY_CYCLE';END IF;
 IF EXISTS(WITH RECURSIVE tree AS(SELECT id,parent_id,1 depth FROM juyu.categories UNION ALL SELECT c.id,c.parent_id,t.depth+1 FROM tree t JOIN juyu.categories c ON c.id=t.parent_id WHERE t.depth<=10) SELECT 1 FROM tree WHERE depth>10) THEN RAISE EXCEPTION 'CATEGORY_DEPTH';END IF;
 RETURN p_config||jsonb_build_object('id',p_id,'version',next_version);
END $$;
REVOKE ALL ON juyu.category_versions FROM PUBLIC,juyu_runtime;
GRANT SELECT ON juyu.category_versions TO juyu_runtime;
CREATE POLICY category_versions_admin_read ON juyu.category_versions FOR SELECT TO juyu_runtime USING(juyu.is_admin() AND juyu.review_admin_eligible(juyu.actor_id()));
REVOKE ALL ON FUNCTION juyu.category_config(juyu.categories),juyu.valid_category_config(jsonb),juyu.audit_category_change(),juyu.protect_category_history(),juyu.read_category_definitions(),juyu.write_category_definition(uuid,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_category_definitions(),juyu.write_category_definition(uuid,integer,jsonb) TO juyu_runtime;

ALTER TABLE juyu.revisions ADD COLUMN category_ids uuid[] NOT NULL DEFAULT '{}', ADD COLUMN category_binding_required boolean NOT NULL DEFAULT true;
-- Populate before enforcing immutable row updates. Existing evidence and UUIDs stay intact.
ALTER TABLE juyu.revisions DISABLE TRIGGER USER;
UPDATE juyu.revisions r SET category_ids=ARRAY(SELECT category_id FROM juyu.revision_categories rc WHERE rc.document_id=r.document_id AND rc.revision_id=r.revision_id ORDER BY category_id);
ALTER TABLE juyu.revisions ENABLE TRIGGER USER;
REVOKE INSERT ON juyu.revision_categories FROM juyu_runtime;
CREATE FUNCTION juyu.guard_revision_categories() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
DECLARE prior uuid[];who text;d juyu.documents;
BEGIN
 IF current_user=(SELECT pg_get_userbyid(c.relowner) FROM pg_class c WHERE c.oid='juyu.revisions'::regclass) THEN NEW.category_binding_required:=false;RETURN NEW;END IF;
 NEW.category_binding_required:=true;
 IF cardinality(NEW.category_ids)>20 OR array_ndims(NEW.category_ids)>1 OR EXISTS(SELECT 1 FROM unnest(NEW.category_ids) id WHERE id IS NULL) OR cardinality(NEW.category_ids)<>(SELECT count(DISTINCT id) FROM unnest(NEW.category_ids) id) THEN RAISE EXCEPTION 'INVALID_INPUT: category IDs';END IF;
 SELECT * INTO d FROM juyu.documents WHERE id=NEW.document_id FOR UPDATE;
 SELECT coalesce(array_agg(rc.category_id ORDER BY rc.category_id),'{}') INTO prior FROM juyu.revision_categories rc WHERE rc.document_id=NEW.document_id AND rc.revision_id=d.workflow_revision_id;
 IF cardinality(NEW.category_ids)=0 AND cardinality(prior)=0 THEN RETURN NEW;END IF;
 who:=juyu.actor_id();PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 PERFORM pg_advisory_xact_lock(84620949);
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) OR who IS DISTINCT FROM NEW.editor_id THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF d.lifecycle<>'active' OR d.workflow_state='in_review' OR NEW.revision_id<>coalesce((SELECT max(revision_id)+1 FROM juyu.revisions WHERE document_id=NEW.document_id),1) THEN RAISE EXCEPTION 'INVALID_STATE';END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.category_ids) candidate(id) WHERE NOT EXISTS(SELECT 1 FROM juyu.categories c WHERE c.id=candidate.id)) THEN RAISE EXCEPTION 'INVALID_INPUT: unknown category';END IF;
 IF EXISTS(WITH RECURSIVE ancestors AS(SELECT c.id,c.parent_id,c.enabled,ARRAY[c.id] path FROM juyu.categories c WHERE c.id=ANY(NEW.category_ids) AND NOT c.id=ANY(prior) UNION ALL SELECT c.id,c.parent_id,c.enabled,a.path||c.id FROM ancestors a JOIN juyu.categories c ON c.id=a.parent_id WHERE NOT c.id=ANY(a.path) AND cardinality(a.path)<=10) SELECT 1 FROM ancestors WHERE NOT enabled OR cardinality(path)>10) THEN RAISE EXCEPTION 'INVALID_INPUT: disabled category';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER revision_categories_validate BEFORE INSERT ON juyu.revisions FOR EACH ROW EXECUTE FUNCTION juyu.guard_revision_categories();
CREATE FUNCTION juyu.bind_revision_categories() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) SELECT NEW.document_id,NEW.revision_id,id FROM unnest(NEW.category_ids) id;RETURN NEW;
END $$;
CREATE TRIGGER revision_categories_bind AFTER INSERT ON juyu.revisions FOR EACH ROW EXECUTE FUNCTION juyu.bind_revision_categories();
CREATE FUNCTION juyu.check_category_draft_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT NEW.category_binding_required THEN RETURN NULL;END IF;
 IF cardinality(NEW.category_ids)=0 AND NOT EXISTS(SELECT 1 FROM juyu.revision_categories WHERE document_id=NEW.document_id AND revision_id<NEW.revision_id) THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM juyu.documents d JOIN juyu.audit_log a ON a.document_id=d.id AND a.sequence=d.sequence WHERE d.id=NEW.document_id AND d.workflow_revision_id=NEW.revision_id AND d.workflow_state='draft' AND d.lifecycle='active' AND a.revision_id=NEW.revision_id AND a.actor_id=NEW.editor_id AND a.action IN('create','edit')) THEN RAISE EXCEPTION 'INVALID_STATE: category draft binding';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER category_draft_binding AFTER INSERT ON juyu.revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION juyu.check_category_draft_binding();
REVOKE ALL ON FUNCTION juyu.guard_revision_categories(),juyu.bind_revision_categories(),juyu.check_category_draft_binding() FROM PUBLIC;

-- Restore keeps historical IDs even if their current policy is disabled.
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
 INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,tags,cover_alt,cover_position,content_blocks,qa_category,qa_position,custom_fields,category_ids)
 VALUES(p_document,next_revision,source.title,source.body,source.audience,source.author_id,who,stamp,source.tags,source.cover_alt,source.cover_position,source.content_blocks,source.qa_category,source.qa_position,source.custom_fields,ARRAY(SELECT rc.category_id FROM juyu.revision_categories rc WHERE rc.document_id=p_document AND rc.revision_id=p_source ORDER BY rc.category_id));
 INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) SELECT p_document,next_revision,ra.asset_id,ra.usage FROM juyu.revision_assets ra WHERE ra.document_id=p_document AND ra.revision_id=p_source;
 UPDATE juyu.documents SET sequence=d.sequence+1,workflow_revision_id=next_revision,workflow_state='draft',submitted_by=NULL,reviewer_id=NULL,approved_by=NULL,updated_at=stamp WHERE id=p_document;
 INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,source_revision_id,previous_published_revision_id,at) VALUES(p_document,d.sequence+1,'restore_version',who,next_revision,p_source,d.published_revision_id,stamp);
 RETURN QUERY SELECT p_document,d.sequence+1,next_revision,p_source,'draft'::text,d.published_revision_id;
END $$;
REVOKE ALL ON FUNCTION juyu.restore_document_version(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.restore_document_version(text,integer,integer) TO juyu_runtime;

