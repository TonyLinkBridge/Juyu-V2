-- Q&A-only discovery reuses the published text index. No content is copied or rewritten.
CREATE FUNCTION juyu.search_qa_publications(query text)
RETURNS TABLE(id text,title text,revision integer,tags text[],category text,"position" integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE terms text[];query_grams text[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id WHERE m.verified_email IS NOT NULL AND m.observed_at IS NOT NULL) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF query IS NULL OR char_length(btrim(query))=0 OR char_length(query)>120 OR query ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 terms:=regexp_split_to_array(btrim(query),' +');
 SELECT coalesce(array_agg(DISTINCT gram),ARRAY[]::text[]) INTO query_grams FROM unnest(terms) term CROSS JOIN LATERAL unnest(juyu.search_grams(juyu.search_fold(term))) gram;
 RETURN QUERY SELECT d.id,r.title,r.revision_id,r.tags,r.qa_category,r.qa_position
 FROM juyu.revision_search s JOIN juyu.documents d ON d.id=s.document_id AND d.published_revision_id=s.revision_id
 JOIN juyu.revisions r ON r.document_id=s.document_id AND r.revision_id=s.revision_id
 WHERE d.kind='qa' AND d.lifecycle='active' AND s.grams @> query_grams AND juyu.can_read_revision(d.id,r.revision_id)
 AND NOT EXISTS(SELECT 1 FROM unnest(terms) term WHERE strpos(s.folded_text,juyu.search_fold(term))=0);
END $$;
REVOKE ALL ON FUNCTION juyu.search_qa_publications(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.search_qa_publications(text) TO juyu_runtime;
