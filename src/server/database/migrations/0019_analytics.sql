-- Search text is private by default, including any populated legacy rows.
UPDATE juyu.search_queries SET query='sha256:'||encode(sha256(convert_to(query,'UTF8')),'hex') WHERE query !~ '^sha256:[a-f0-9]{64}$';
ALTER TABLE juyu.search_queries ADD COLUMN search_page integer NOT NULL DEFAULT 1 CHECK(search_page BETWEEN 1 AND 999999);
ALTER TABLE juyu.search_queries ADD CONSTRAINT search_queries_private_query CHECK(query ~ '^sha256:[a-f0-9]{64}$');
ALTER TABLE juyu.analytics_events ADD COLUMN feedback_helpful boolean, ADD COLUMN feedback_version integer CHECK(feedback_version>0);
ALTER TABLE juyu.analytics_events ADD CONSTRAINT analytics_feedback_metadata CHECK((kind='feedback') OR (feedback_helpful IS NULL AND feedback_version IS NULL));
CREATE UNIQUE INDEX analytics_feedback_once ON juyu.analytics_events(member_id,document_id,revision_id,feedback_version) WHERE kind='feedback';

CREATE FUNCTION juyu.analytics_integer(value jsonb,minimum integer,maximum integer) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE n numeric;
BEGIN
 IF jsonb_typeof(value) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 n:=(value#>>'{}')::numeric;IF n<>trunc(n) OR n<minimum OR n>maximum THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;RETURN n::integer;
END $$;
CREATE FUNCTION juyu.analytics_input(p jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE kind text;keys text[];n integer;q text;r jsonb;results jsonb:='[]';s jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 kind:=p->>'kind';
 CASE kind WHEN 'view' THEN keys:=ARRAY['kind','eventId','documentId','revision'];
 WHEN 'search' THEN keys:=ARRAY['kind','eventId','query','page','total','results'];
 WHEN 'search_click' THEN keys:=ARRAY['kind','eventId','documentId','revision','position','search'];
 ELSE RAISE EXCEPTION 'INVALID_INPUT';END CASE;
 IF NOT p ?& keys OR (SELECT count(*) FROM jsonb_object_keys(p))<>cardinality(keys) OR jsonb_typeof(p->'kind')<>'string'
  OR jsonb_typeof(p->'eventId') IS DISTINCT FROM 'string' OR (p->>'eventId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 p:=jsonb_set(p,'{eventId}',to_jsonb(lower(p->>'eventId')));
 IF kind IN('view','search_click') THEN
  IF jsonb_typeof(p->'documentId') IS DISTINCT FROM 'string' OR btrim(p->>'documentId')='' OR p->>'documentId'<>btrim(p->>'documentId') OR char_length(p->>'documentId')>200 OR (p->>'documentId') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
  n:=juyu.analytics_integer(p->'revision',1,2147483647);
 END IF;
 IF kind='search' THEN
  IF jsonb_typeof(p->'query') IS DISTINCT FROM 'string' OR char_length(p->>'query')>120 OR (p->>'query') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
  q:=btrim(regexp_replace(p->>'query','\s+',' ','g'));IF q='' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;p:=jsonb_set(p,'{query}',to_jsonb(q));
  n:=juyu.analytics_integer(p->'page',1,999999);n:=juyu.analytics_integer(p->'total',0,2147483647);
  IF jsonb_typeof(p->'results') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'results')>20 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p->'results') LOOP
   IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
   IF NOT r ?& ARRAY['documentId','revision'] OR (SELECT count(*) FROM jsonb_object_keys(r))<>2 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
   s:=juyu.analytics_input(r||jsonb_build_object('kind','view','eventId',p->>'eventId'));results:=results||jsonb_build_array(s-'kind'-'eventId');
  END LOOP;p:=jsonb_set(p,'{results}',results);
 ELSIF kind='search_click' THEN
  n:=juyu.analytics_integer(p->'position',1,2147483647);
  IF jsonb_typeof(p->'search') IS DISTINCT FROM 'object' OR (p->'search') ? 'kind' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
  s:=juyu.analytics_input(p->'search'||jsonb_build_object('kind','search'));p:=jsonb_set(p,'{search}',s-'kind');
 END IF;RETURN p;
END $$;

-- Private helper; caller takes all event-key advisory locks first, before document/member row locks.
CREATE FUNCTION juyu.capture_analytics_search(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;sid uuid;fingerprint text;stored juyu.search_queries;stored_results jsonb;inserted uuid;item jsonb;
BEGIN
 who:=juyu.actor_id();sid:=(p->>'eventId')::uuid;fingerprint:='sha256:'||encode(sha256(convert_to(p->>'query','UTF8')),'hex');
 IF EXISTS(SELECT 1 FROM juyu.analytics_events WHERE id=sid) THEN RAISE EXCEPTION 'CONFLICT';END IF;
 SELECT * INTO stored FROM juyu.search_queries WHERE id=sid;
 IF FOUND THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('documentId',document_id,'revision',revision_id) ORDER BY position),'[]') INTO stored_results FROM juyu.search_results WHERE search_id=sid;
  IF stored.member_id<>who OR stored.query<>fingerprint OR stored.search_page<>(p->>'page')::integer OR stored.result_count<>(p->>'total')::integer OR stored_results<>p->'results' THEN RAISE EXCEPTION 'CONFLICT';END IF;
 END IF;
 -- This lock order matches publication/purge: documents, then member. Never lock a result row before its document.
 PERFORM d.id FROM juyu.documents d WHERE d.id IN(SELECT value->>'documentId' FROM jsonb_array_elements(p->'results')) ORDER BY d.id COLLATE "C" FOR SHARE;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id WHERE i.member_id=who AND nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF stored.id IS NOT NULL THEN
  FOR item IN SELECT value FROM jsonb_array_elements(p->'results') LOOP
   IF NOT juyu.can_read_revision(item->>'documentId',(item->>'revision')::integer) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  END LOOP;RETURN;
 END IF;
 -- The count, ordered snapshot, comparison and both inserts use a single authoritative SQL snapshot.
 WITH actual AS MATERIALIZED (
  SELECT coalesce(max(s.total),0)::integer AS total,coalesce(jsonb_agg(jsonb_build_object('documentId',s.id,'revision',s.revision) ORDER BY s.title COLLATE "C",s.id COLLATE "C") FILTER(WHERE s.id IS NOT NULL),'[]') AS results
  FROM juyu.search_publications(string_to_array(p->>'query',' '),(p->>'page')::integer) s
 ), saved AS (
  INSERT INTO juyu.search_queries(id,member_id,query,result_count,search_page,occurred_at)
  SELECT sid,who,fingerprint,total,(p->>'page')::integer,clock_timestamp() FROM actual WHERE total=(p->>'total')::integer AND results=p->'results' RETURNING id
 ), results AS (
  INSERT INTO juyu.search_results(search_id,position,document_id,revision_id)
  SELECT saved.id,((p->>'page')::integer-1)*20+ordinal::integer,r.value->>'documentId',(r.value->>'revision')::integer FROM saved CROSS JOIN actual CROSS JOIN LATERAL jsonb_array_elements(actual.results) WITH ORDINALITY r(value,ordinal) RETURNING search_id
 ) SELECT id INTO inserted FROM saved;
 IF inserted IS NULL THEN RAISE EXCEPTION 'SNAPSHOT_CHANGED';END IF;
END $$;

CREATE FUNCTION juyu.capture_analytics(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE p jsonb;who text;eid uuid;sid uuid;key text;kind text;current_revision integer;stored juyu.analytics_events;
BEGIN
 p:=juyu.analytics_input(p_input);kind:=p->>'kind';eid:=(p->>'eventId')::uuid;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 SELECT i.member_id INTO who FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL;
 IF who IS NULL THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF kind='search_click' THEN sid:=(p->'search'->>'eventId')::uuid;IF sid=eid THEN RAISE EXCEPTION 'CONFLICT';END IF;END IF;
 FOR key IN SELECT DISTINCT x FROM unnest(ARRAY[eid::text,sid::text]) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended('analytics:'||key,0));END LOOP;
 IF kind='search' THEN PERFORM juyu.capture_analytics_search(p-'kind');RETURN jsonb_build_object('eventId',eid,'kind',kind);END IF;
 IF EXISTS(SELECT 1 FROM juyu.search_queries WHERE id=eid) THEN RAISE EXCEPTION 'CONFLICT';END IF;
 SELECT * INTO stored FROM juyu.analytics_events WHERE id=eid;
 IF FOUND AND (stored.member_id<>who OR stored.kind<>kind OR stored.document_id<>p->>'documentId' OR stored.revision_id<>(p->>'revision')::integer OR stored.search_id IS DISTINCT FROM sid OR stored.result_position IS DISTINCT FROM CASE WHEN kind='search_click' THEN (p->>'position')::integer END) THEN RAISE EXCEPTION 'CONFLICT';END IF;
 IF kind='search_click' THEN
  PERFORM juyu.capture_analytics_search(p->'search');
  IF NOT EXISTS(SELECT 1 FROM juyu.search_results WHERE search_id=sid AND position=(p->>'position')::integer AND document_id=p->>'documentId' AND revision_id=(p->>'revision')::integer) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 END IF;
 SELECT published_revision_id INTO current_revision FROM juyu.documents WHERE id=p->>'documentId' FOR SHARE;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id WHERE i.member_id=who AND nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF NOT juyu.can_read_document(p->>'documentId') THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF current_revision IS DISTINCT FROM (p->>'revision')::integer THEN RAISE EXCEPTION 'VERSION_CHANGED';END IF;
 IF stored.id IS NULL THEN INSERT INTO juyu.analytics_events(id,member_id,kind,document_id,revision_id,search_id,result_position,occurred_at) VALUES(eid,who,kind,p->>'documentId',(p->>'revision')::integer,sid,CASE WHEN kind='search_click' THEN (p->>'position')::integer END,clock_timestamp());END IF;
 RETURN jsonb_build_object('eventId',eid,'kind',kind);
END $$;

-- Analytics is best effort and must never roll back an accepted feedback write.
CREATE FUNCTION juyu.capture_feedback_analytics() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.version=OLD.version THEN RETURN NEW;END IF;
 BEGIN
  IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RETURN NEW;END IF;
  IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id WHERE i.member_id=NEW.member_id AND nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) OR NOT juyu.can_read_revision(NEW.document_id,NEW.revision_id) THEN RETURN NEW;END IF;
  INSERT INTO juyu.analytics_events(id,member_id,kind,document_id,revision_id,occurred_at,feedback_helpful,feedback_version)
  VALUES(gen_random_uuid(),NEW.member_id,'feedback',NEW.document_id,NEW.revision_id,clock_timestamp(),NEW.helpful,NEW.version)
  ON CONFLICT(member_id,document_id,revision_id,feedback_version) WHERE kind='feedback' DO NOTHING;
 EXCEPTION WHEN query_canceled OR OTHERS THEN
  -- No payload, exception detail or raw comment in logs. No analytics success receipt is emitted.
  RAISE WARNING 'FEEDBACK_ANALYTICS_FAILED';
 END;RETURN NEW;
END $$;
CREATE TRIGGER feedback_analytics AFTER INSERT OR UPDATE ON juyu.feedback FOR EACH ROW EXECUTE FUNCTION juyu.capture_feedback_analytics();
REVOKE ALL ON FUNCTION juyu.analytics_integer(jsonb,integer,integer),juyu.analytics_input(jsonb),juyu.capture_analytics_search(jsonb),juyu.capture_analytics(jsonb),juyu.capture_feedback_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.capture_analytics(jsonb) TO juyu_runtime;
