-- Each language is a separate document with its own immutable revisions and
-- review/publication state. Existing documents remain Chinese sources.
ALTER TABLE juyu.documents ADD COLUMN locale text NOT NULL DEFAULT 'zh-CN'
 CHECK (locale IN ('zh-CN','en'));
ALTER TABLE juyu.documents ADD COLUMN translation_of text REFERENCES juyu.documents(id)
 DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE juyu.documents ADD CONSTRAINT document_locale_source_check CHECK
 ((locale='zh-CN' AND translation_of IS NULL) OR
  (locale='en' AND translation_of IS NOT NULL AND translation_of<>id));
CREATE UNIQUE INDEX one_english_document_per_source ON juyu.documents(translation_of)
 WHERE locale='en';
CREATE INDEX document_locale_lookup ON juyu.documents(locale,id);

-- Category labels are written by editors, never machine-translated. A missing
-- English label remains visibly untranslated rather than inventing a name.
CREATE TABLE juyu.category_english_names (
 category_id uuid PRIMARY KEY REFERENCES juyu.categories(id),
 name text CHECK (name IS NULL OR (name=btrim(name) AND char_length(name) BETWEEN 1 AND 120 AND name !~ '[[:cntrl:]]')),
 category_version integer NOT NULL CHECK (category_version>0),
 changed_by text NOT NULL REFERENCES juyu.members(clerk_user_id),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON juyu.category_english_names FROM PUBLIC,juyu_runtime,juyu_context_issuer;
CREATE TABLE juyu.category_english_name_events (
 category_id uuid NOT NULL REFERENCES juyu.categories(id),
 category_version integer NOT NULL,
 name text,
 changed_by text NOT NULL REFERENCES juyu.members(clerk_user_id),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(category_id,category_version)
);
REVOKE ALL ON juyu.category_english_name_events FROM PUBLIC,juyu_runtime,juyu_context_issuer;
CREATE FUNCTION juyu.read_category_english_names()
RETURNS TABLE(category_id uuid,name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT n.category_id,n.name FROM juyu.category_english_names n
 WHERE (juyu.is_admin() AND juyu.review_admin_eligible(juyu.actor_id())) OR juyu.category_allowed(n.category_id)
$$;
REVOKE ALL ON FUNCTION juyu.read_category_english_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_category_english_names() TO juyu_runtime;
CREATE FUNCTION juyu.set_category_english_name(p_id uuid,p_version integer,p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;actual_version integer;prior juyu.category_english_name_events;
BEGIN
 IF p_id IS NULL OR p_version IS NULL OR p_version<1 OR (p_name IS NOT NULL AND (p_name<>btrim(p_name) OR char_length(p_name)<1 OR char_length(p_name)>120 OR p_name ~ '[[:cntrl:]]')) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT current_version INTO actual_version FROM juyu.categories WHERE id=p_id FOR UPDATE;
 IF actual_version IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF actual_version<>p_version THEN RAISE EXCEPTION 'CATEGORY_CONFLICT';END IF;
 SELECT * INTO prior FROM juyu.category_english_name_events WHERE category_id=p_id AND category_version=p_version;
 IF FOUND THEN
  IF prior.name IS NOT DISTINCT FROM p_name AND prior.changed_by=who THEN RETURN p_name;END IF;
  RAISE EXCEPTION 'CATEGORY_CONFLICT';
 END IF;
 INSERT INTO juyu.category_english_names(category_id,name,category_version,changed_by) VALUES(p_id,p_name,p_version,who)
 ON CONFLICT(category_id) DO UPDATE SET name=excluded.name,category_version=excluded.category_version,changed_by=excluded.changed_by,changed_at=clock_timestamp();
 INSERT INTO juyu.category_english_name_events(category_id,category_version,name,changed_by) VALUES(p_id,p_version,p_name,who);
 RETURN p_name;
END $$;
REVOKE ALL ON FUNCTION juyu.set_category_english_name(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.set_category_english_name(uuid,integer,text) TO juyu_runtime;

CREATE FUNCTION juyu.check_translation_source() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE source_kind text; source_locale text;
BEGIN
 IF NEW.locale='en' THEN
  SELECT d.kind,d.locale INTO source_kind,source_locale FROM juyu.documents d WHERE d.id=NEW.translation_of;
  IF source_kind IS NULL THEN RAISE EXCEPTION 'TRANSLATION_SOURCE_MISSING';END IF;
  IF source_locale<>'zh-CN' OR source_kind<>NEW.kind THEN
   RAISE EXCEPTION 'TRANSLATION_KIND_MISMATCH';
  END IF;
 ELSIF EXISTS(SELECT 1 FROM juyu.documents d WHERE d.translation_of=NEW.id AND (d.kind<>NEW.kind OR NEW.locale<>'zh-CN')) THEN
  RAISE EXCEPTION 'TRANSLATION_KIND_MISMATCH';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER translation_source_integrity
 AFTER INSERT OR UPDATE OF locale,translation_of,kind ON juyu.documents
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION juyu.check_translation_source();

-- English content cannot outlive the source's current visibility or permission.
CREATE OR REPLACE FUNCTION juyu.can_read_document(document text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE source_id text;allowed boolean;
BEGIN
 SELECT d.translation_of,
  d.lifecycle='active' AND juyu.audience_allowed(r.audience)
   AND (d.kind<>'ops' OR (SELECT role FROM juyu.current_identity()) IN ('ops','admin'))
   AND NOT EXISTS(SELECT 1 FROM juyu.revision_categories rc
    WHERE rc.document_id=d.id AND rc.revision_id=r.revision_id AND NOT juyu.category_allowed(rc.category_id))
 INTO source_id,allowed
 FROM juyu.documents d JOIN juyu.revisions r
  ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 WHERE d.id=document;
 IF NOT coalesce(allowed,false) THEN RETURN false;END IF;
 IF source_id IS NULL THEN RETURN true;END IF;
 RETURN juyu.can_read_document(source_id);
END $$;

CREATE FUNCTION juyu.read_translation_variant(p_document text,p_locale text)
RETURNS TABLE(id text,locale text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF p_locale NOT IN ('zh-CN','en') OR p_locale IS NULL THEN RAISE EXCEPTION 'INVALID_LOCALE';END IF;
 IF NOT juyu.can_read_document(p_document) THEN RETURN;END IF;
 RETURN QUERY SELECT target.id,target.locale FROM juyu.documents original
 JOIN juyu.documents target ON target.id=coalesce(original.translation_of,original.id)
  OR target.translation_of=coalesce(original.translation_of,original.id)
 WHERE original.id=p_document AND target.locale=p_locale AND juyu.can_read_document(target.id);
END $$;
REVOKE ALL ON FUNCTION juyu.read_translation_variant(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_translation_variant(text,text) TO juyu_runtime;

CREATE FUNCTION juyu.read_publication_language(p_document text)
RETURNS TABLE(locale text,source_id text,english_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.can_read_document(p_document) THEN RETURN;END IF;
 RETURN QUERY SELECT d.locale,coalesce(d.translation_of,d.id),e.id
 FROM juyu.documents d LEFT JOIN juyu.documents e
  ON e.translation_of=coalesce(d.translation_of,d.id) AND e.locale='en'
  AND juyu.can_read_document(e.id)
 WHERE d.id=p_document;
END $$;
REVOKE ALL ON FUNCTION juyu.read_publication_language(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_publication_language(text) TO juyu_runtime;

-- Count and page after language and permission filters so results cannot mix
-- English and Chinese or leak totals from the other language.
CREATE FUNCTION juyu.search_publications_locale(terms text[],requested_page integer,requested_kind text,requested_locale text)
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
  SELECT d.id,r.title,d.kind,r.revision_id,r.tags
  FROM juyu.revision_search s JOIN juyu.documents d ON d.id=s.document_id AND d.published_revision_id=s.revision_id
  JOIN juyu.revisions r ON r.document_id=s.document_id AND r.revision_id=s.revision_id
  WHERE d.locale=requested_locale AND (requested_kind IS NULL OR d.kind=requested_kind)
   AND s.grams @> query_grams AND juyu.can_read_revision(s.document_id,s.revision_id)
   AND NOT EXISTS(SELECT 1 FROM unnest(terms) term WHERE strpos(s.folded_text,juyu.search_fold(term))=0)
 ), count_rows AS (SELECT count(*) AS n FROM matches), page_rows AS (
  SELECT * FROM matches ORDER BY matches.title COLLATE "C",matches.id COLLATE "C" LIMIT 20 OFFSET (requested_page-1)*20
 )
 SELECT p.id,p.title,p.kind,p.revision_id,p.tags,s.search_text,c.n FROM count_rows c LEFT JOIN page_rows p ON true
 LEFT JOIN juyu.revision_search s ON s.document_id=p.id AND s.revision_id=p.revision_id
 ORDER BY p.title COLLATE "C",p.id COLLATE "C";
END $$;
REVOKE ALL ON FUNCTION juyu.search_publications_locale(text[],integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.search_publications_locale(text[],integer,text,text) TO juyu_runtime;

CREATE FUNCTION juyu.read_changelog_locale(p_page integer,p_locale text)
RETURNS TABLE(id text,kind text,title text,published_at timestamptz,publication_number integer,release_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.id,d.kind,r.title,max(a.at) AS published_at,juyu.publication_number(d.id),r.release_note
 FROM juyu.documents d
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 JOIN juyu.audit_log a ON a.document_id=d.id AND a.revision_id=r.revision_id AND a.action='publish'
 WHERE p_page BETWEEN 1 AND 100 AND p_locale IN ('zh-CN','en') AND d.locale=p_locale
  AND juyu.can_read_revision(d.id,r.revision_id)
 GROUP BY d.id,d.kind,r.title,r.release_note
 ORDER BY published_at DESC,d.id COLLATE "C"
 LIMIT 21 OFFSET (p_page-1)*20
$$;
REVOKE ALL ON FUNCTION juyu.read_changelog_locale(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_changelog_locale(integer,text) TO juyu_runtime;
