-- A timing sample belongs to an already accepted open. It never creates another open.
CREATE TABLE juyu.analytics_visible_time (
 view_id uuid PRIMARY KEY REFERENCES juyu.analytics_events(id) ON DELETE CASCADE,
 visible_ms integer NOT NULL CHECK(visible_ms BETWEEN 0 AND 43200000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE juyu.analytics_visible_time ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON juyu.analytics_visible_time TO juyu_runtime;
CREATE POLICY visible_time_admin_read ON juyu.analytics_visible_time FOR SELECT TO juyu_runtime USING(juyu.is_admin());
CREATE FUNCTION juyu.capture_view_time(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;visit juyu.analytics_events;milliseconds integer;vid uuid;eid uuid;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT p ?& ARRAY['kind','eventId','viewId','documentId','revision','visibleMs'] OR (SELECT count(*) FROM jsonb_object_keys(p))<>6
  OR p->>'kind'<>'view_time' OR jsonb_typeof(p->'eventId') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'viewId') IS DISTINCT FROM 'string'
  OR p->>'eventId' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  OR p->>'viewId' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  OR jsonb_typeof(p->'documentId') IS DISTINCT FROM 'string' OR nullif(btrim(p->>'documentId'),'') IS NULL
  OR char_length(p->>'documentId')>200 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 milliseconds:=juyu.analytics_integer(p->'visibleMs',0,43200000);
 PERFORM juyu.analytics_integer(p->'revision',1,2147483647);
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 SELECT i.member_id INTO who FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
 WHERE m.observed_at IS NOT NULL AND nullif(btrim(m.verified_email),'') IS NOT NULL;
 IF who IS NULL THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 vid:=(p->>'viewId')::uuid;eid:=(p->>'eventId')::uuid;
 -- Same document-first order as publication/purge; no lock inversion with event removal.
 PERFORM id FROM juyu.documents WHERE id=p->>'documentId' AND lifecycle='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE i.member_id=who AND m.observed_at IS NOT NULL AND nullif(btrim(m.verified_email),'') IS NOT NULL) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO visit FROM juyu.analytics_events WHERE id=vid AND kind='view' AND member_id=who
  AND document_id=p->>'documentId' AND revision_id=(p->>'revision')::integer FOR SHARE;
 IF NOT FOUND OR NOT juyu.can_read_document(visit.document_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 -- Do not trust the client to report longer than server-observed wall time.
 milliseconds:=least(milliseconds,greatest(0,least(43200000,floor(extract(epoch FROM (clock_timestamp()-visit.occurred_at))*1000))::integer));
 INSERT INTO juyu.analytics_visible_time(view_id,visible_ms) VALUES(vid,milliseconds)
 ON CONFLICT(view_id) DO UPDATE SET visible_ms=greatest(juyu.analytics_visible_time.visible_ms,EXCLUDED.visible_ms),updated_at=clock_timestamp();
 RETURN jsonb_build_object('eventId',eid,'kind','view_time');
END $$;
REVOKE ALL ON FUNCTION juyu.capture_view_time(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.capture_view_time(jsonb) TO juyu_runtime;
