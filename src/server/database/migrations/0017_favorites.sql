-- Favorites remain personal document links. Access and formal metadata are resolved on every read.
CREATE INDEX favorites_member_order ON juyu.favorites(member_id,created_at DESC,document_id COLLATE "C");
CREATE FUNCTION juyu.read_favorite_publications()
RETURNS TABLE(id text,title text,kind text,revision integer,tags text[],saved_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN QUERY SELECT d.id,r.title,d.kind,r.revision_id,r.tags,f.created_at
 FROM juyu.favorites f JOIN juyu.documents d ON d.id=f.document_id
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 WHERE f.member_id=juyu.actor_id() AND d.lifecycle='active' AND juyu.can_read_revision(d.id,r.revision_id);
END $$;
REVOKE ALL ON FUNCTION juyu.read_favorite_publications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_favorite_publications() TO juyu_runtime;

-- Explicit desired state, with no raw runtime INSERT/UPDATE/DELETE grant.
CREATE FUNCTION juyu.save_favorite(p_document text,p_revision integer,p_saved boolean)
RETURNS TABLE(document_id text,revision integer,saved boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;current_revision integer;
BEGIN
 IF p_document IS NULL OR btrim(p_document)='' OR p_document<>btrim(p_document) OR char_length(p_document)>200 OR p_document ~ '[[:cntrl:]]' OR p_revision IS NULL OR p_revision<1 OR p_saved IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY'; END IF;
 SELECT i.member_id INTO who FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
 WHERE nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL;
 IF who IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 -- A per-member/document lock serializes adds and removes even when no row exists.
 PERFORM pg_advisory_xact_lock(hashtextextended('favorite:'||length(who)||':'||who||':'||p_document,0));
 IF p_saved THEN
  -- Preserve the existing document-before-member order used by publication and lifecycle writes.
  SELECT d.published_revision_id INTO current_revision FROM juyu.documents d WHERE d.id=p_document FOR SHARE;
 END IF;
 PERFORM m.clerk_user_id FROM juyu.members m WHERE m.clerk_user_id=who FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE i.member_id=who AND nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_saved THEN
  IF NOT juyu.can_read_document(p_document) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF current_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'VERSION_CHANGED'; END IF;
  INSERT INTO juyu.favorites AS f(member_id,document_id,created_at) VALUES(who,p_document,clock_timestamp())
   ON CONFLICT ON CONSTRAINT favorites_pkey DO NOTHING;
 ELSE
  -- Removing one's link does not disclose document existence, access, metadata or affected rows.
  DELETE FROM juyu.favorites f WHERE f.member_id=who AND f.document_id=p_document;
 END IF;
 RETURN QUERY SELECT p_document,p_revision,p_saved;
END $$;
REVOKE ALL ON FUNCTION juyu.save_favorite(text,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.save_favorite(text,integer,boolean) TO juyu_runtime;
