ALTER TABLE juyu.revisions ADD COLUMN description text NOT NULL DEFAULT ''
 CHECK (char_length(description) <= 300 AND description = btrim(description) AND description !~ '[[:cntrl:]]');

CREATE FUNCTION juyu.read_publication_description(document text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT r.description FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 WHERE d.id=document AND juyu.can_read_revision(r.document_id,r.revision_id)
$$;
REVOKE ALL ON FUNCTION juyu.read_publication_description(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_publication_description(text) TO juyu_runtime;

-- The existing restore procedure contains the authorization, locking, audit,
-- and media checks. Change only its revision copy so an old description is
-- restored with the rest of that exact version.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('juyu.restore_document_version(text,integer,integer)'::regprocedure) INTO definition;
 IF position('category_ids,icon_key)' IN definition)=0 OR position('source.icon_key);' IN definition)=0 THEN
  RAISE EXCEPTION 'RESTORE_DEFINITION_CHANGED';
 END IF;
 definition:=replace(definition,'category_ids,icon_key)','category_ids,icon_key,description)');
 definition:=replace(definition,'source.icon_key);','source.icon_key,source.description);');
 EXECUTE definition;
END $$;
