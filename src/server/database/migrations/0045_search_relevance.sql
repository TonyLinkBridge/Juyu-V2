-- Rank exact titles, title phrases and tags ahead of body-only matches while
-- preserving the existing authorization, locale and literal matching rules.
CREATE OR REPLACE FUNCTION juyu.search_publications_locale(terms text[],requested_page integer,requested_kind text,requested_locale text)
RETURNS TABLE(id text,title text,kind text,revision integer,tags text[],search_text text,total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE query_grams text[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF requested_locale NOT IN ('zh-CN','en') OR requested_locale IS NULL
  OR (requested_kind IS NOT NULL AND requested_kind NOT IN ('article','ops','reference','qa'))
  OR requested_page IS NULL OR requested_page<1 OR requested_page>999999
  OR terms IS NULL OR cardinality(terms)<1 OR cardinality(terms)>120 OR array_ndims(terms)<>1
  OR EXISTS(SELECT 1 FROM unnest(terms) term WHERE term IS NULL OR char_length(term)=0 OR char_length(term)>120 OR term ~ '[[:cntrl:]]')
  OR (SELECT sum(char_length(term)) FROM unnest(terms) term)>120 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 SELECT coalesce(array_agg(DISTINCT gram),ARRAY[]::text[]) INTO query_grams
 FROM unnest(terms) term CROSS JOIN LATERAL unnest(juyu.search_grams(juyu.search_fold(term))) gram;
 RETURN QUERY
 WITH matches AS MATERIALIZED (
  SELECT d.id,r.title,d.kind,r.revision_id,r.tags,
   CASE
    WHEN juyu.search_fold(r.title)=juyu.search_fold(array_to_string(terms,' ')) THEN 0
    WHEN NOT EXISTS(SELECT 1 FROM unnest(terms) term WHERE strpos(juyu.search_fold(r.title),juyu.search_fold(term))=0) THEN 1
    WHEN NOT EXISTS(SELECT 1 FROM unnest(terms) term WHERE NOT EXISTS(
     SELECT 1 FROM unnest(r.tags) tag WHERE strpos(juyu.search_fold(tag),juyu.search_fold(term))>0
    )) THEN 2
    ELSE 3
   END AS relevance
  FROM juyu.revision_search s JOIN juyu.documents d ON d.id=s.document_id AND d.published_revision_id=s.revision_id
  JOIN juyu.revisions r ON r.document_id=s.document_id AND r.revision_id=s.revision_id
  WHERE d.locale=requested_locale AND (requested_kind IS NULL OR d.kind=requested_kind)
   AND s.grams @> query_grams AND juyu.can_read_revision(s.document_id,s.revision_id)
   AND NOT EXISTS(SELECT 1 FROM unnest(terms) term WHERE strpos(s.folded_text,juyu.search_fold(term))=0)
 ), count_rows AS (SELECT count(*) AS n FROM matches), page_rows AS (
  SELECT * FROM matches ORDER BY relevance,matches.title COLLATE "C",matches.id COLLATE "C" LIMIT 20 OFFSET (requested_page-1)*20
 )
 SELECT p.id,p.title,p.kind,p.revision_id,p.tags,s.search_text,c.n FROM count_rows c LEFT JOIN page_rows p ON true
 LEFT JOIN juyu.revision_search s ON s.document_id=p.id AND s.revision_id=p.revision_id
 ORDER BY p.relevance,p.title COLLATE "C",p.id COLLATE "C";
END $$;
REVOKE ALL ON FUNCTION juyu.search_publications_locale(text[],integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.search_publications_locale(text[],integer,text,text) TO juyu_runtime;
