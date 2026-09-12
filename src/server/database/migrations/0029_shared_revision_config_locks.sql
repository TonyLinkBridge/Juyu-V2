-- R23: revision validation reads configuration; ordinary saves share locks.
-- Configuration writers retain exclusive locks. Apply before deploying shared-lock repository code.
-- No data or historical migrations are modified.


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
 IF EXISTS(SELECT 1 FROM unnest(NEW.category_ids) candidate(id) WHERE NOT EXISTS(SELECT 1 FROM juyu.categories c WHERE c.id=candidate.id)) THEN RAISE EXCEPTION 'INVALID_INPUT: unknown category';END IF;
 IF EXISTS(WITH RECURSIVE ancestors AS(SELECT c.id,c.parent_id,c.enabled,ARRAY[c.id] path FROM juyu.categories c WHERE c.id=ANY(NEW.category_ids) AND NOT c.id=ANY(prior) UNION ALL SELECT c.id,c.parent_id,c.enabled,a.path||c.id FROM ancestors a JOIN juyu.categories c ON c.id=a.parent_id WHERE NOT c.id=ANY(a.path) AND cardinality(a.path)<=10) SELECT 1 FROM ancestors WHERE NOT enabled OR cardinality(path)>10) THEN RAISE EXCEPTION 'INVALID_INPUT: disabled category';END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION juyu.guard_revision_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
DECLARE previous jsonb;definition jsonb;field jsonb;saved jsonb;who text;blank boolean;
BEGIN
 -- A SECURITY DEFINER restore runs as the actual table owner. Runtime cannot
 -- impersonate that role or toggle this trusted bypass with a session setting.
 IF current_user=(SELECT pg_get_userbyid(c.relowner) FROM pg_class c WHERE c.oid='juyu.revisions'::regclass) THEN RETURN NEW;END IF;
 IF NOT juyu.valid_field_snapshots(NEW.custom_fields) THEN RAISE EXCEPTION 'INVALID_INPUT: field snapshots';END IF;
 -- Match repository ordering: document, member, then global field config lock.
 PERFORM id FROM juyu.documents WHERE id=NEW.document_id FOR UPDATE;
 who:=juyu.actor_id();PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 PERFORM pg_advisory_xact_lock_shared(84620948);
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
