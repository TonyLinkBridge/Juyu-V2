-- Narrow Reference discovery; existing publication and raw table permissions remain intact.
CREATE FUNCTION juyu.read_reference_publications() RETURNS TABLE(id text,title text,revision integer,tags text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE m.verified_email IS NOT NULL AND m.observed_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN QUERY
  SELECT d.id,r.title,r.revision_id,r.tags
  FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
  WHERE d.kind='reference' AND d.lifecycle='active' AND juyu.can_read_revision(d.id,r.revision_id);
END $$;
REVOKE ALL ON FUNCTION juyu.read_reference_publications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_reference_publications() TO juyu_runtime;
