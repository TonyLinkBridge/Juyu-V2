-- Append-only version fields. Existing revisions retain empty tags/default crop.
CREATE FUNCTION juyu.valid_article_tags(tags text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT cardinality(tags)<=12 AND (cardinality(tags)=0 OR (array_ndims(tags)=1 AND array_lower(tags,1)=1))
 AND NOT EXISTS (SELECT 1 FROM unnest(tags) t WHERE t IS NULL OR t<>btrim(t) OR char_length(t) NOT BETWEEN 1 AND 40 OR t ~ '[[:cntrl:]]')
 AND (SELECT count(DISTINCT t)=count(*) FROM unnest(tags) t)
$$;
ALTER TABLE juyu.revisions ADD COLUMN tags text[] NOT NULL DEFAULT '{}' CHECK (juyu.valid_article_tags(tags));
ALTER TABLE juyu.revisions ADD COLUMN cover_alt text NOT NULL DEFAULT '' CHECK (char_length(cover_alt)<=200 AND cover_alt !~ '[[:cntrl:]]');
ALTER TABLE juyu.revisions ADD COLUMN cover_position double precision NOT NULL DEFAULT 50 CHECK (cover_position>=0 AND cover_position<=100);

-- The existing cover relationship remains the one source of asset ownership.
-- Runtime can attach only while a new version is assembled, before its audit event.
GRANT UPDATE(status) ON juyu.assets TO juyu_runtime;
CREATE POLICY assets_lock ON juyu.assets FOR UPDATE TO juyu_runtime USING (juyu.is_admin()) WITH CHECK (false);
GRANT INSERT ON juyu.revision_assets,juyu.revision_categories TO juyu_runtime;
CREATE POLICY revision_assets_insert ON juyu.revision_assets FOR INSERT TO juyu_runtime WITH CHECK (
 juyu.is_admin() AND EXISTS(SELECT 1 FROM juyu.revisions r WHERE r.document_id=revision_assets.document_id AND r.revision_id=revision_assets.revision_id AND r.editor_id=juyu.actor_id())
 AND NOT EXISTS(SELECT 1 FROM juyu.audit_log l WHERE l.document_id=revision_assets.document_id AND l.revision_id=revision_assets.revision_id)
 AND (usage<>'cover' OR EXISTS(SELECT 1 FROM juyu.assets a WHERE a.id=asset_id AND a.document_id=revision_assets.document_id AND a.status='ready' AND a.mime_type IN ('image/png','image/jpeg','image/webp','image/gif')))
);
CREATE POLICY revision_categories_insert ON juyu.revision_categories FOR INSERT TO juyu_runtime WITH CHECK (
 juyu.is_admin() AND EXISTS(SELECT 1 FROM juyu.revisions r WHERE r.document_id=revision_categories.document_id AND r.revision_id=revision_categories.revision_id AND r.editor_id=juyu.actor_id())
 AND NOT EXISTS(SELECT 1 FROM juyu.audit_log l WHERE l.document_id=revision_categories.document_id AND l.revision_id=revision_categories.revision_id)
);

-- New function rather than changing the return type of existing publication APIs.
CREATE FUNCTION juyu.read_publication_presentation(document text)
RETURNS TABLE(tags text[],cover_asset_id uuid,cover_alt text,cover_position double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT r.tags,a.id,CASE WHEN a.id IS NULL THEN '' ELSE r.cover_alt END,r.cover_position
 FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 LEFT JOIN juyu.revision_assets ra ON ra.document_id=r.document_id AND ra.revision_id=r.revision_id AND ra.usage='cover'
 LEFT JOIN juyu.assets a ON a.id=ra.asset_id AND a.document_id=r.document_id AND a.status='ready'
   AND a.mime_type IN ('image/png','image/jpeg','image/webp','image/gif') AND juyu.can_read_asset(a.id)
 WHERE d.id=document AND juyu.can_read_revision(r.document_id,r.revision_id)
$$;
REVOKE ALL ON FUNCTION juyu.valid_article_tags(text[]),juyu.read_publication_presentation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.valid_article_tags(text[]),juyu.read_publication_presentation(text) TO juyu_runtime;
