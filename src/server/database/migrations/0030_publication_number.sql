-- A reader-facing publication number is independent of draft revision IDs.
CREATE FUNCTION juyu.publication_number(p_document text) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE published integer;first_sequence integer;result integer;
BEGIN
 SELECT published_revision_id INTO published FROM juyu.documents WHERE id=p_document;
 IF published IS NULL OR NOT coalesce(juyu.can_read_revision(p_document,published),false) THEN RETURN NULL;END IF;
 SELECT min(sequence) INTO first_sequence FROM juyu.audit_log WHERE document_id=p_document AND action='publish' AND revision_id=published;
 IF first_sequence IS NULL THEN RETURN NULL;END IF;
 SELECT count(DISTINCT revision_id)::integer INTO result FROM juyu.audit_log WHERE document_id=p_document AND action='publish' AND sequence<=first_sequence;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION juyu.publication_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.publication_number(text) TO juyu_runtime;
