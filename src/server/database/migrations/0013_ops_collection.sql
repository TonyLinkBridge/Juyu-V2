-- A narrow employee projection; raw document/revision policies are unchanged.
CREATE FUNCTION juyu.read_ops_publications() RETURNS TABLE(id text,title text,revision integer,tags text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE i.role IN ('ops','admin') AND m.verified_email IS NOT NULL AND m.observed_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN QUERY
  SELECT d.id,r.title,r.revision_id,r.tags
  FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
  WHERE d.kind='ops' AND d.lifecycle='active' AND juyu.can_read_document(d.id);
END $$;
REVOKE ALL ON FUNCTION juyu.read_ops_publications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_ops_publications() TO juyu_runtime;
