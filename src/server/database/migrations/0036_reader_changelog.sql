-- List only the current authorized publication of each document, ordered by its
-- actual publish event. History, draft titles, and private document rows stay hidden.
CREATE INDEX audit_publication_feed ON juyu.audit_log (at DESC,document_id,revision_id) WHERE action='publish';
CREATE FUNCTION juyu.read_changelog(p_page integer)
RETURNS TABLE(id text,kind text,title text,published_at timestamptz,publication_number integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.id,d.kind,r.title,max(a.at) AS published_at,juyu.publication_number(d.id) AS publication_number
 FROM juyu.documents d
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 JOIN juyu.audit_log a ON a.document_id=d.id AND a.revision_id=r.revision_id AND a.action='publish'
 WHERE p_page BETWEEN 1 AND 100 AND juyu.can_read_revision(d.id,r.revision_id)
 GROUP BY d.id,d.kind,r.title
 ORDER BY published_at DESC,d.id COLLATE "C"
 LIMIT 21 OFFSET (p_page-1)*20
$$;
REVOKE ALL ON FUNCTION juyu.read_changelog(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_changelog(integer) TO juyu_runtime;
