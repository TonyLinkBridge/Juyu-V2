-- Release notes belong to the reviewed revision. An unpublished draft note must
-- never appear in the employee changelog.
ALTER TABLE juyu.revisions ADD COLUMN release_note text NOT NULL DEFAULT ''
 CHECK (char_length(release_note) <= 600 AND release_note = btrim(release_note) AND replace(release_note,E'\n','') !~ '[[:cntrl:]]');

DROP FUNCTION juyu.read_changelog(integer);
CREATE FUNCTION juyu.read_changelog(p_page integer)
RETURNS TABLE(id text,kind text,title text,published_at timestamptz,publication_number integer,release_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.id,d.kind,r.title,max(a.at) AS published_at,juyu.publication_number(d.id) AS publication_number,r.release_note
 FROM juyu.documents d
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 JOIN juyu.audit_log a ON a.document_id=d.id AND a.revision_id=r.revision_id AND a.action='publish'
 WHERE p_page BETWEEN 1 AND 100 AND juyu.can_read_revision(d.id,r.revision_id)
 GROUP BY d.id,d.kind,r.title,r.release_note
 ORDER BY published_at DESC,d.id COLLATE "C"
 LIMIT 21 OFFSET (p_page-1)*20
$$;
REVOKE ALL ON FUNCTION juyu.read_changelog(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_changelog(integer) TO juyu_runtime;

-- Restore a historical version's note together with that version's content.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('juyu.restore_document_version(text,integer,integer)'::regprocedure) INTO definition;
 IF position('category_ids,icon_key,description)' IN definition)=0 OR position('source.icon_key,source.description);' IN definition)=0 THEN
  RAISE EXCEPTION 'RESTORE_DEFINITION_CHANGED';
 END IF;
 definition:=replace(definition,'category_ids,icon_key,description)','category_ids,icon_key,description,release_note)');
 definition:=replace(definition,'source.icon_key,source.description);','source.icon_key,source.description,source.release_note);');
 EXECUTE definition;
END $$;
