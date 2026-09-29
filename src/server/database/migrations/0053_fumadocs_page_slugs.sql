-- Fumadocs page URLs are based on stable slugs. The slug belongs to the
-- document (not a revision), so editing a title never silently changes links.
ALTER TABLE juyu.documents ADD COLUMN slug text;
ALTER TABLE juyu.documents ADD CONSTRAINT documents_publication_slug_check CHECK(
 (kind IN ('article','ops') AND slug IS NOT NULL AND slug=btrim(slug)
  AND char_length(slug) BETWEEN 1 AND 250
  AND slug !~ '[[:space:]/\\?#%]' AND slug !~ '[[:cntrl:]]')
 OR (kind NOT IN ('article','ops') AND slug IS NULL)
) NOT VALID;
CREATE UNIQUE INDEX documents_publication_slug_unique ON juyu.documents(kind,slug)
 WHERE kind IN ('article','ops');

-- The application supplies title-based slugs. This database fallback keeps
-- imports and maintenance scripts valid without allowing an empty route.
CREATE FUNCTION juyu.default_publication_slug() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NEW.kind IN ('article','ops') AND NEW.slug IS NULL THEN
  NEW.slug:='document-'||substr(md5(NEW.id),1,12);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER publication_slug_default BEFORE INSERT ON juyu.documents
 FOR EACH ROW EXECUTE FUNCTION juyu.default_publication_slug();

CREATE FUNCTION juyu.protect_publication_slug() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,juyu AS $$
BEGIN
 -- The only allowed change fills a pre-migration NULL during the backfill below.
 IF OLD.slug IS NOT NULL AND OLD.slug IS DISTINCT FROM NEW.slug THEN RAISE EXCEPTION 'IMMUTABLE: publication slug cannot be changed';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER publication_slug_immutable BEFORE UPDATE OF slug ON juyu.documents
 FOR EACH ROW EXECUTE FUNCTION juyu.protect_publication_slug();

-- Readers can resolve a canonical slug without receiving raw access to the
-- documents table. Old document IDs remain accepted for durable links.
CREATE FUNCTION juyu.resolve_publication_path(p_value text,p_kind text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.id FROM juyu.documents d
 WHERE p_kind IN ('article','ops') AND d.kind=p_kind
  AND (d.id=p_value OR d.slug=p_value) AND juyu.can_read_document(d.id)
 ORDER BY (d.id=p_value) DESC LIMIT 1
$$;
CREATE FUNCTION juyu.read_publication_slug(p_document text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.slug FROM juyu.documents d WHERE d.id=p_document AND juyu.can_read_document(d.id)
$$;
REVOKE ALL ON FUNCTION juyu.resolve_publication_path(text,text),juyu.read_publication_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.resolve_publication_path(text,text),juyu.read_publication_slug(text) TO juyu_runtime;

-- Keep the backfill last. Older databases have deferred document trigger events;
-- running more table DDL after this UPDATE would make PostgreSQL reject the upgrade.
DO $$
DECLARE
 row record;
 base text;
 candidate text;
 suffix integer;
BEGIN
 FOR row IN
  SELECT d.id,d.kind,r.title
  FROM juyu.documents d
  JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.workflow_revision_id
  WHERE d.kind IN ('article','ops')
  ORDER BY d.created_at,d.id COLLATE "C"
 LOOP
  base:=lower(regexp_replace(regexp_replace(btrim(row.title),'[[:space:]/\\?#%]+','-','g'),'^-+|-+$','','g'));
  IF base='' OR base IS NULL THEN base:='document-'||substr(md5(row.id),1,12);END IF;
  IF char_length(base)>240 THEN base:=left(base,227)||'-'||substr(md5(row.id),1,12);END IF;
  candidate:=base;suffix:=2;
  WHILE EXISTS(SELECT 1 FROM juyu.documents d WHERE d.kind=row.kind AND d.slug=candidate) LOOP
   candidate:=base||'-'||suffix;suffix:=suffix+1;
  END LOOP;
  UPDATE juyu.documents SET slug=candidate WHERE id=row.id;
 END LOOP;
END $$;
