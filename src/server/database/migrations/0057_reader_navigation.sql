-- Narrow current-publication projection. Do not grant readers raw document access.
-- Joining the published pointer first avoids scanning/authorizing every historical
-- revision and repeatedly resolving language/slug/position for the same document.
CREATE FUNCTION juyu.read_publication_navigation(p_locale text)
RETURNS TABLE(id text,slug text,title text,description text,body text,icon_key text,"position" integer,category_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.id,d.slug,r.title,r.description,
  CASE WHEN r.description<>'' THEN '' ELSE r.body END,
  r.icon_key,d.navigation_position,
  ARRAY(SELECT rc.category_id FROM juyu.revision_categories rc
   WHERE rc.document_id=d.id AND rc.revision_id=d.published_revision_id
   ORDER BY rc.category_id)
 FROM juyu.documents d JOIN juyu.revisions r
  ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 WHERE p_locale IN ('zh-CN','en') AND d.locale=p_locale
  AND juyu.can_read_document(d.id)
$$;
REVOKE ALL ON FUNCTION juyu.read_publication_navigation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_publication_navigation(text) TO juyu_runtime;
