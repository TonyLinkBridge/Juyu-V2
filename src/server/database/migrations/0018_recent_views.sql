-- Keep a bounded personal history; legacy entries use the same deterministic order as new visits.
WITH ranked AS (
 SELECT member_id,document_id,row_number() OVER(PARTITION BY member_id ORDER BY viewed_at DESC,document_id COLLATE "C") AS position
 FROM juyu.recent_views
)
DELETE FROM juyu.recent_views r USING ranked x WHERE r.member_id=x.member_id AND r.document_id=x.document_id AND x.position>100;
CREATE INDEX recent_views_member_order ON juyu.recent_views(member_id,viewed_at DESC,document_id COLLATE "C");

-- The historical revision records what was opened; current publication controls visibility and labels.
CREATE FUNCTION juyu.read_recent_publications()
RETURNS TABLE(id text,title text,kind text,revision integer,tags text[],viewed_revision integer,viewed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN QUERY SELECT d.id,r.title,d.kind,r.revision_id,r.tags,v.revision_id,v.viewed_at
 FROM juyu.recent_views v JOIN juyu.documents d ON d.id=v.document_id
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 WHERE v.member_id=juyu.actor_id() AND d.lifecycle='active' AND juyu.can_read_revision(d.id,r.revision_id);
END $$;
REVOKE ALL ON FUNCTION juyu.read_recent_publications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_recent_publications() TO juyu_runtime;

CREATE FUNCTION juyu.record_recent_view(p_document text,p_revision integer)
RETURNS TABLE(document_id text,revision integer,viewed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;current_revision integer;recorded_at timestamptz;
BEGIN
 IF p_document IS NULL OR btrim(p_document)='' OR p_document<>btrim(p_document) OR char_length(p_document)>200 OR p_document ~ '[[:cntrl:]]' OR p_revision IS NULL OR p_revision<1 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY'; END IF;
 SELECT i.member_id INTO who FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
 WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL;
 IF who IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 -- Serialize all this actor's visits before taking document locks: different-document inserts cannot exceed the cap.
 -- Purge does not acquire this lock; it can finish deleting a trim candidate without waiting for this actor.
 PERFORM pg_advisory_xact_lock(hashtextextended('recent:'||length(who)||':'||who,0));
 SELECT d.published_revision_id INTO current_revision FROM juyu.documents d WHERE d.id=p_document FOR SHARE;
 -- Preserve the document-before-member lock order used by current lifecycle/publication writes.
 PERFORM m.clerk_user_id FROM juyu.members m WHERE m.clerk_user_id=who FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE i.member_id=who AND nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT juyu.can_read_document(p_document) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF current_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'VERSION_CHANGED'; END IF;
 recorded_at:=clock_timestamp();
 INSERT INTO juyu.recent_views AS v(member_id,document_id,revision_id,viewed_at) VALUES(who,p_document,p_revision,recorded_at)
 ON CONFLICT ON CONSTRAINT recent_views_pkey DO UPDATE SET revision_id=EXCLUDED.revision_id,viewed_at=EXCLUDED.viewed_at;
 DELETE FROM juyu.recent_views v WHERE v.member_id=who AND v.document_id IN(
  SELECT old.document_id FROM juyu.recent_views old WHERE old.member_id=who ORDER BY old.viewed_at DESC,old.document_id COLLATE "C" OFFSET 100
 );
 RETURN QUERY SELECT p_document,p_revision,recorded_at;
END $$;
REVOKE ALL ON FUNCTION juyu.record_recent_view(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.record_recent_view(text,integer) TO juyu_runtime;
