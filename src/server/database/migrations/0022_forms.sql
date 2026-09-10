-- Form definitions and submitted payloads are immutable snapshots, independent of article revisions.
CREATE TABLE juyu.forms(id uuid PRIMARY KEY,current_version integer NOT NULL CHECK(current_version BETWEEN 1 AND 2147483646));
CREATE TABLE juyu.form_versions(form_id uuid NOT NULL REFERENCES juyu.forms(id),version integer NOT NULL CHECK(version BETWEEN 1 AND 2147483646),config jsonb NOT NULL,request jsonb NOT NULL,changed_by text NOT NULL REFERENCES juyu.members(clerk_user_id),changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(form_id,version));
CREATE TABLE juyu.form_submissions(id uuid PRIMARY KEY,form_id uuid NOT NULL,form_version integer NOT NULL,submitted_by text NOT NULL REFERENCES juyu.members(clerk_user_id),submitted_name text NOT NULL,submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),values jsonb NOT NULL,FOREIGN KEY(form_id,form_version) REFERENCES juyu.form_versions(form_id,version));
CREATE TABLE juyu.form_record_states(id uuid PRIMARY KEY REFERENCES juyu.form_submissions(id),sequence integer NOT NULL DEFAULT 0 CHECK(sequence BETWEEN 0 AND 2147483646),status text NOT NULL DEFAULT 'new' CHECK(status IN('new','processing','resolved')),note text NOT NULL DEFAULT '' CHECK(char_length(note)<=2000),processed_by text REFERENCES juyu.members(clerk_user_id),processed_name text,processed_at timestamptz,CHECK((status='new' AND sequence=0 AND note='' AND processed_by IS NULL AND processed_name IS NULL AND processed_at IS NULL) OR(status<>'new' AND sequence>0 AND processed_by IS NOT NULL AND processed_name IS NOT NULL AND processed_at IS NOT NULL)));
CREATE TABLE juyu.form_processing_events(record_id uuid NOT NULL REFERENCES juyu.form_submissions(id),sequence integer NOT NULL CHECK(sequence>0),status text NOT NULL CHECK(status IN('processing','resolved')),note text NOT NULL CHECK(char_length(note)<=2000),actor_id text NOT NULL REFERENCES juyu.members(clerk_user_id),actor_name text NOT NULL,at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(record_id,sequence));
CREATE INDEX form_submissions_order ON juyu.form_submissions(submitted_at DESC,id);
DO $$ DECLARE relation text; BEGIN FOREACH relation IN ARRAY ARRAY['forms','form_versions','form_submissions','form_record_states','form_processing_events'] LOOP EXECUTE format('ALTER TABLE juyu.%I ENABLE ROW LEVEL SECURITY',relation);EXECUTE format('ALTER TABLE juyu.%I FORCE ROW LEVEL SECURITY',relation);EXECUTE format('REVOKE ALL ON juyu.%I FROM PUBLIC,juyu_runtime',relation);END LOOP;END $$;
CREATE FUNCTION juyu.protect_form_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE: form evidence';END $$;
CREATE TRIGGER form_version_immutable BEFORE UPDATE OR DELETE ON juyu.form_versions FOR EACH ROW EXECUTE FUNCTION juyu.protect_form_evidence();
CREATE TRIGGER form_submission_immutable BEFORE UPDATE OR DELETE ON juyu.form_submissions FOR EACH ROW EXECUTE FUNCTION juyu.protect_form_evidence();
CREATE TRIGGER form_processing_immutable BEFORE UPDATE OR DELETE ON juyu.form_processing_events FOR EACH ROW EXECUTE FUNCTION juyu.protect_form_evidence();
CREATE TRIGGER form_no_delete BEFORE DELETE ON juyu.forms FOR EACH ROW EXECUTE FUNCTION juyu.protect_form_evidence();
CREATE FUNCTION juyu.form_member_eligible() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$ SELECT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) $$;
CREATE FUNCTION juyu.valid_form_request(config jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE binding jsonb;label text;
BEGIN
 IF jsonb_typeof(config) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(config))<>5 OR NOT config ?& ARRAY['title','description','audience','enabled','fields'] THEN RETURN false;END IF;
 IF jsonb_typeof(config->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(config->'description') IS DISTINCT FROM 'string' OR char_length(config->>'description')>2000 OR jsonb_typeof(config->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(config->'audience') IS DISTINCT FROM 'string' OR config->>'audience' NOT IN('staff','ops','admin') OR jsonb_typeof(config->'fields') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 label:=config->>'title';IF char_length(label) NOT BETWEEN 1 AND 120 OR label<>btrim(label,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') OR label ~ '[[:cntrl:]]' OR label ~ U&'[\0080-\009F]' OR jsonb_array_length(config->'fields') NOT BETWEEN 1 AND 20 THEN RETURN false;END IF;
 FOR binding IN SELECT * FROM jsonb_array_elements(config->'fields') LOOP
  IF jsonb_typeof(binding) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(binding))<>4 OR NOT binding ?& ARRAY['id','version','required','width'] OR jsonb_typeof(binding->'id') IS DISTINCT FROM 'string' OR binding->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR jsonb_typeof(binding->'version') IS DISTINCT FROM 'number' OR binding->>'version' !~ '^[1-9][0-9]*$' OR (binding->>'version')::numeric>=2147483647 OR jsonb_typeof(binding->'required') IS DISTINCT FROM 'boolean' OR jsonb_typeof(binding->'width') IS DISTINCT FROM 'string' OR binding->>'width' NOT IN('full','half') THEN RETURN false;END IF;
 END LOOP;
 RETURN (SELECT count(DISTINCT x->>'id')=count(*) FROM jsonb_array_elements(config->'fields') x);
END $$;
CREATE FUNCTION juyu.read_forms(p_admin boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF p_admin IS NULL OR NOT juyu.form_member_eligible() OR (p_admin AND (NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()))) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN (SELECT coalesce(jsonb_agg(v.config||jsonb_build_object('id',f.id,'version',f.current_version) ORDER BY v.config->>'title',f.id),'[]') FROM juyu.forms f JOIN juyu.form_versions v ON v.form_id=f.id AND v.version=f.current_version WHERE p_admin OR ((v.config->>'enabled')::boolean AND juyu.audience_allowed(v.config->>'audience')));
END $$;
CREATE FUNCTION juyu.read_form(p_id uuid,p_admin boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE result jsonb;
BEGIN
 IF p_id IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 SELECT f INTO result FROM jsonb_array_elements(juyu.read_forms(p_admin)) f WHERE f->>'id'=p_id::text;IF result IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;RETURN result;
END $$;
CREATE FUNCTION juyu.write_form(p_id uuid,p_expected integer,p_config jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;form_row juyu.forms;previous juyu.form_versions;next_version integer;binding jsonb;old_field jsonb;definition jsonb;snapshot jsonb:='[]';final_config jsonb;
BEGIN
 IF p_id IS NULL OR (p_expected IS NOT NULL AND (p_expected<1 OR p_expected>=2147483647)) OR NOT coalesce(juyu.valid_form_request(p_config),false) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 PERFORM pg_advisory_xact_lock(84620950);PERFORM pg_advisory_xact_lock(84620948);
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO form_row FROM juyu.forms WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  SELECT * INTO previous FROM juyu.form_versions WHERE form_id=p_id AND version=form_row.current_version;
  IF form_row.current_version=coalesce(p_expected,0)+1 AND previous.changed_by=who AND previous.request=p_config THEN RETURN previous.config||jsonb_build_object('id',p_id,'version',form_row.current_version);END IF;
  IF p_expected IS DISTINCT FROM form_row.current_version THEN RAISE EXCEPTION 'FORM_CONFLICT';END IF;next_version:=form_row.current_version+1;IF next_version>=2147483647 THEN RAISE EXCEPTION 'FORM_LIMIT';END IF;
 ELSE
  IF p_expected IS NOT NULL THEN RAISE EXCEPTION 'FORM_CONFLICT';END IF;IF (SELECT count(*) FROM juyu.forms)>=50 THEN RAISE EXCEPTION 'FORM_LIMIT';END IF;next_version:=1;
 END IF;
 FOR binding IN SELECT * FROM jsonb_array_elements(p_config->'fields') LOOP
  SELECT f->'field' INTO old_field FROM jsonb_array_elements(previous.config->'fields') f WHERE f->'field'->>'id'=binding->>'id' AND f->'field'->'version'=binding->'version';
  IF old_field IS NOT NULL THEN definition:=old_field;
  ELSE
   SELECT v.config||jsonb_build_object('id',s.id,'version',s.current_version) INTO definition FROM juyu.settings s JOIN juyu.setting_versions v ON v.setting_id=s.id AND v.version=s.current_version WHERE s.kind='field' AND s.id::text=binding->>'id';
   IF definition IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT: unknown field';END IF;
   IF definition->'version' IS DISTINCT FROM binding->'version' THEN RAISE EXCEPTION 'FIELD_CONFLICT';END IF;IF NOT (definition->>'enabled')::boolean THEN RAISE EXCEPTION 'INVALID_INPUT: disabled field';END IF;
  END IF;
  snapshot:=snapshot||jsonb_build_array(jsonb_build_object('field',definition,'required',binding->'required','width',binding->'width'));
 END LOOP;
 final_config:=jsonb_set(p_config,'{fields}',snapshot);
 INSERT INTO juyu.forms(id,current_version) VALUES(p_id,next_version) ON CONFLICT(id) DO UPDATE SET current_version=excluded.current_version;
 INSERT INTO juyu.form_versions(form_id,version,config,request,changed_by) VALUES(p_id,next_version,final_config,p_config,who);
 RETURN final_config||jsonb_build_object('id',p_id,'version',next_version);
END $$;
CREATE FUNCTION juyu.valid_form_values(p_fields jsonb,p_values jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE entry jsonb;binding jsonb;field jsonb;value jsonb;kind text;blank boolean;
BEGIN
 IF jsonb_typeof(p_values) IS DISTINCT FROM 'array' OR jsonb_array_length(p_values)>20 OR jsonb_array_length(p_values)<>jsonb_array_length(p_fields) THEN RETURN false;END IF;
 FOR entry IN SELECT * FROM jsonb_array_elements(p_values) LOOP
  IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(entry))<>2 OR NOT entry ?& ARRAY['fieldId','value'] OR jsonb_typeof(entry->'fieldId') IS DISTINCT FROM 'string' OR entry->>'fieldId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false;END IF;
  SELECT b INTO binding FROM jsonb_array_elements(p_fields) b WHERE b->'field'->>'id'=entry->>'fieldId';IF binding IS NULL THEN RETURN false;END IF;
  field:=binding->'field';value:=entry->'value';kind:=jsonb_typeof(value);
  IF kind='null' THEN IF (binding->>'required')::boolean THEN RETURN false;END IF;CONTINUE;END IF;
  IF field->>'type'='number' THEN IF kind<>'number' OR abs((value#>>'{}')::numeric)>1.7976931348623157e308 THEN RETURN false;END IF;
  ELSIF field->>'type'='boolean' THEN IF kind<>'boolean' THEN RETURN false;END IF;
  ELSE
   IF kind<>'string' OR char_length(value#>>'{}')>2000 THEN RETURN false;END IF;
   blank:=btrim(value#>>'{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')='';IF blank THEN RETURN false;END IF;
   IF field->>'type'='date' AND NOT juyu.valid_field_date(value#>>'{}') THEN RETURN false;END IF;
   IF field->>'type'='select' AND NOT (field->'options' @> jsonb_build_array(value)) THEN RETURN false;END IF;
  END IF;
 END LOOP;
 RETURN (SELECT count(DISTINCT e->>'fieldId')=count(*) FROM jsonb_array_elements(p_values) e);
END $$;
CREATE FUNCTION juyu.form_receipt(s juyu.form_submissions) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,juyu AS $$ SELECT jsonb_build_object('id',s.id,'formId',s.form_id,'formVersion',s.form_version,'submittedAt',s.submitted_at) $$;
CREATE FUNCTION juyu.submit_form(p_form uuid,p_id uuid,p_version integer,p_values jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;display text;prior juyu.form_submissions;form_row juyu.forms;config jsonb;canonical jsonb;result juyu.form_submissions;
BEGIN
 IF p_form IS NULL OR p_id IS NULL OR p_version IS NULL OR p_version<1 OR p_version>=2147483647 OR jsonb_typeof(p_values) IS DISTINCT FROM 'array' OR jsonb_array_length(p_values)>20 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.form_member_eligible() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('form-submit:'||p_id::text,0));
 SELECT display_name INTO display FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.form_member_eligible() OR who IS DISTINCT FROM juyu.actor_id() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(v ORDER BY v->>'fieldId'),'[]') INTO canonical FROM jsonb_array_elements(p_values) v;
 SELECT * INTO prior FROM juyu.form_submissions WHERE id=p_id;
 IF FOUND THEN
  IF prior.submitted_by=who AND prior.form_id=p_form AND prior.form_version=p_version AND prior.values=canonical THEN RETURN juyu.form_receipt(prior);END IF;RAISE EXCEPTION 'SUBMISSION_CONFLICT';
 END IF;
 PERFORM pg_advisory_xact_lock_shared(84620950);
 IF NOT juyu.form_member_eligible() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO form_row FROM juyu.forms WHERE id=p_form;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT v.config INTO config FROM juyu.form_versions v WHERE v.form_id=p_form AND v.version=form_row.current_version;
 IF NOT (config->>'enabled')::boolean OR NOT juyu.audience_allowed(config->>'audience') THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF p_version<>form_row.current_version THEN RAISE EXCEPTION 'FORM_CONFLICT';END IF;
 IF NOT coalesce(juyu.valid_form_values(config->'fields',canonical),false) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 INSERT INTO juyu.form_submissions(id,form_id,form_version,submitted_by,submitted_name,values) VALUES(p_id,p_form,p_version,who,display,canonical) RETURNING * INTO result;
 INSERT INTO juyu.form_record_states(id) VALUES(p_id);RETURN juyu.form_receipt(result);
END $$;
CREATE FUNCTION juyu.form_record_json(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT jsonb_build_object('id',s.id,'formId',s.form_id,'formVersion',s.form_version,'title',v.config->'title','submittedBy',jsonb_build_object('id',s.submitted_by,'name',s.submitted_name),'submittedAt',s.submitted_at,'status',r.status,'sequence',r.sequence,'note',r.note,'processedBy',CASE WHEN r.processed_by IS NULL THEN NULL ELSE jsonb_build_object('id',r.processed_by,'name',r.processed_name) END,'processedAt',r.processed_at,'fields',v.config->'fields','values',s.values)
 FROM juyu.form_submissions s JOIN juyu.form_versions v ON v.form_id=s.form_id AND v.version=s.form_version JOIN juyu.form_record_states r ON r.id=s.id WHERE s.id=p_id
$$;
CREATE FUNCTION juyu.read_form_record(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE result jsonb;
BEGIN
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_id IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;result:=juyu.form_record_json(p_id);IF result IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;RETURN result;
END $$;
CREATE FUNCTION juyu.read_form_records(p_page integer DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE total integer;pages integer;page integer;items jsonb;
BEGIN
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_page IS NULL OR p_page<1 OR p_page>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 SELECT count(*)::integer INTO total FROM juyu.form_submissions;pages:=greatest(1,ceil(total/20.0)::integer);page:=least(p_page,pages);
 SELECT coalesce(jsonb_agg(juyu.form_record_json(s.id) ORDER BY s.submitted_at DESC,s.id),'[]') INTO items FROM(SELECT id,submitted_at FROM juyu.form_submissions ORDER BY submitted_at DESC,id LIMIT 20 OFFSET (page-1)*20) s;
 RETURN jsonb_build_object('items',items,'total',total,'page',page,'pages',pages);
END $$;
CREATE FUNCTION juyu.process_form_record(p_id uuid,p_expected integer,p_status text,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;display text;state juyu.form_record_states;stamp timestamptz;
BEGIN
 IF p_id IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 OR p_status IS NULL OR p_status NOT IN('processing','resolved') OR p_note IS NULL OR char_length(p_note)>2000 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO state FROM juyu.form_record_states WHERE id=p_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT display_name INTO display FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF NOT(state.sequence=p_expected+1 AND state.processed_by=who AND state.status=p_status AND state.note=p_note) THEN
  IF state.sequence<>p_expected THEN RAISE EXCEPTION 'CONFLICT';END IF;IF state.sequence>=2147483646 THEN RAISE EXCEPTION 'FORM_LIMIT';END IF;
  stamp:=clock_timestamp();
  INSERT INTO juyu.form_processing_events(record_id,sequence,status,note,actor_id,actor_name,at) VALUES(p_id,state.sequence+1,p_status,p_note,who,display,stamp);
  UPDATE juyu.form_record_states SET sequence=state.sequence+1,status=p_status,note=p_note,processed_by=who,processed_name=display,processed_at=stamp WHERE id=p_id RETURNING * INTO state;
 END IF;
 RETURN jsonb_build_object('id',p_id,'sequence',state.sequence,'status',state.status,'note',state.note,'processedBy',jsonb_build_object('id',state.processed_by,'name',state.processed_name),'processedAt',state.processed_at);
END $$;
REVOKE ALL ON FUNCTION juyu.protect_form_evidence(),juyu.form_member_eligible(),juyu.valid_form_request(jsonb),juyu.read_forms(boolean),juyu.read_form(uuid,boolean),juyu.write_form(uuid,integer,jsonb),juyu.valid_form_values(jsonb,jsonb),juyu.form_receipt(juyu.form_submissions),juyu.submit_form(uuid,uuid,integer,jsonb),juyu.form_record_json(uuid),juyu.read_form_record(uuid),juyu.read_form_records(integer),juyu.process_form_record(uuid,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_forms(boolean),juyu.read_form(uuid,boolean),juyu.write_form(uuid,integer,jsonb),juyu.submit_form(uuid,uuid,integer,jsonb),juyu.read_form_record(uuid),juyu.read_form_records(integer),juyu.process_form_record(uuid,integer,text,text) TO juyu_runtime;
