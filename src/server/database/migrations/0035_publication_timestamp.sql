CREATE FUNCTION juyu.read_publication_timestamp(document text) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT max(a.at) FROM juyu.documents d
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 JOIN juyu.audit_log a ON a.document_id=d.id AND a.revision_id=r.revision_id AND a.action='publish'
 WHERE d.id=document AND juyu.can_read_revision(r.document_id,r.revision_id)
$$;
REVOKE ALL ON FUNCTION juyu.read_publication_timestamp(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_publication_timestamp(text) TO juyu_runtime;
