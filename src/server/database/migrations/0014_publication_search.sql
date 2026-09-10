-- Immutable revision projections, synchronously inserted with each revision.
-- Native GIN text-array grams avoid extension dependencies. Grams only prune
-- candidates: exact literal AND matching below remains the source of truth.
CREATE FUNCTION juyu.search_fold(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT translate(value,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
$$;
CREATE FUNCTION juyu.search_grams(value text) RETURNS text[] LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path=pg_catalog AS $$
 -- Split UTF-8 once: repeated substr(value, position) rescans prefixes and
 -- becomes quadratic for long Chinese bodies.
 SELECT coalesce(array_agg(DISTINCT gram) FILTER(WHERE gram IS NOT NULL),ARRAY[]::text[])
 FROM (SELECT letter,lead(letter) OVER ordered AS second,lead(letter,2) OVER ordered AS third
  FROM regexp_split_to_table(value,'') WITH ORDINALITY AS letters(letter,position)
  WINDOW ordered AS (ORDER BY position)) letters
 CROSS JOIN LATERAL (VALUES(letter),(letter||second),(letter||second||third)) grams(gram)
$$;
-- Only text that the reader displays. Never serialize whole payloads, asset IDs,
-- storage locations or diagram/math source into the searchable projection.
CREATE FUNCTION juyu.search_media_text(block jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE result text;tab jsonb;row_data jsonb;
BEGIN
 CASE block->>'type'
 WHEN 'hint' THEN RETURN concat_ws(E'\n',block->>'title',block->>'body');
 WHEN 'code' THEN RETURN coalesce(block->>'code','');
 WHEN 'tabs' THEN
  result:='';FOR tab IN SELECT value FROM jsonb_array_elements(block->'tabs') LOOP result:=result||E'\n'||concat_ws(E'\n',tab->>'title',tab->>'body');END LOOP;RETURN result;
 WHEN 'table' THEN
  SELECT string_agg(value,E'\n') INTO result FROM jsonb_array_elements_text(block->'headers');
  FOR row_data IN SELECT value FROM jsonb_array_elements(block->'rows') LOOP
   result:=coalesce(result,'')||E'\n'||(SELECT coalesce(string_agg(value,E'\n'),'') FROM jsonb_array_elements_text(row_data));
  END LOOP;RETURN coalesce(result,'');
 WHEN 'image','video','file' THEN RETURN concat_ws(E'\n',block->>'caption',block->>'alt');
 WHEN 'math','diagram' THEN RETURN coalesce(block->>'caption','');
 ELSE RETURN '';
 END CASE;
END $$;
CREATE FUNCTION juyu.search_editor_text(blocks jsonb,depth integer DEFAULT 0) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE block jsonb;result text:='';part text;
BEGIN
 IF depth>8 OR jsonb_typeof(blocks)<>'array' THEN RETURN '';END IF;
 FOR block IN SELECT value FROM jsonb_array_elements(blocks) LOOP
  IF block->>'type' IN ('paragraph','heading','bulletListItem','numberedListItem') THEN
   SELECT coalesce(string_agg(value->>'text','' ORDER BY ordinal),'') INTO part
   FROM jsonb_array_elements(block->'content') WITH ORDINALITY AS inline(value,ordinal) WHERE value->>'type'='text';
  ELSIF block->>'type'='juyu' THEN part:=juyu.search_media_text((block->'props'->>'payload')::jsonb);
  ELSE part:=''; END IF;
  result:=result||E'\n'||part;
  IF jsonb_typeof(block->'children')='array' THEN result:=result||juyu.search_editor_text(block->'children',depth+1);END IF;
 END LOOP;
 RETURN result;
END $$;
-- Mirrors reader/inline.ts in one pass. Structured/rich-block fields stay literal.
CREATE FUNCTION juyu.search_inline_text(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
 SELECT CASE WHEN value ~ '^\s*(`{3,}|~{3,})' THEN value ELSE
 regexp_replace(value,$pattern$(`+)([^`\n]+)\1|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_$pattern$,$replacement$\2\3\4\5\6$replacement$,'g') END
$$;
CREATE FUNCTION juyu.search_table_cells(value text) RETURNS text[] LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
 SELECT array_agg(regexp_replace(cell,'^\s+|\s+$','','g') ORDER BY ordinal)
 FROM unnest(string_to_array(regexp_replace(regexp_replace(value,'^\s+|\s+$','','g'),'^\||\|$','','g'),'|')) WITH ORDINALITY cells(cell,ordinal)
$$;
-- Same bounded legacy blocks as reader/body.ts: paragraph, heading, list,
-- literal fence and pipe table. Table cells are plain text in DocumentView.
CREATE FUNCTION juyu.search_legacy_text(body text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE lines text[]:=string_to_array(replace(replace(body,E'\r\n',E'\n'),E'\r',E'\n'),E'\n');
 i integer:=1;n integer;line text;next_line text;paragraph text[]:='{}';pieces text[]:='{}';
 marker text[];heading text[];list_item text[];headers text[];divider text[];cells text[];literal text[];
BEGIN
 n:=cardinality(lines);
 WHILE i<=n LOOP
  line:=lines[i];marker:=regexp_match(line,'^ {0,3}(`{3,}|~{3,})');
  IF marker IS NOT NULL THEN
   IF cardinality(paragraph)>0 THEN pieces:=array_append(pieces,juyu.search_inline_text(array_to_string(paragraph,E'\n')));paragraph:='{}';END IF;
   literal:=ARRAY[line];i:=i+1;
   WHILE i<=n LOOP
    literal:=array_append(literal,lines[i]);next_line:=regexp_replace(lines[i],'^\s+|\s+$','','g');i:=i+1;
    IF char_length(next_line)>=char_length(marker[1]) AND replace(next_line,left(marker[1],1),'')='' THEN EXIT;END IF;
   END LOOP;
   pieces:=array_append(pieces,array_to_string(literal,E'\n'));CONTINUE;
  END IF;
  IF line ~ '^\s*$' THEN
   IF cardinality(paragraph)>0 THEN pieces:=array_append(pieces,juyu.search_inline_text(array_to_string(paragraph,E'\n')));paragraph:='{}';END IF;
   i:=i+1;CONTINUE;
  END IF;
  headers:=juyu.search_table_cells(line);divider:=CASE WHEN i<n THEN juyu.search_table_cells(lines[i+1]) ELSE '{}'::text[] END;
  IF line ~ '^\s*\|.*\|\s*$' AND cardinality(headers)>1 AND cardinality(headers)=cardinality(divider)
   AND NOT EXISTS(SELECT 1 FROM unnest(divider) cell WHERE cell !~ '^:?-{3,}:?$') THEN
   IF cardinality(paragraph)>0 THEN pieces:=array_append(pieces,juyu.search_inline_text(array_to_string(paragraph,E'\n')));paragraph:='{}';END IF;
   pieces:=pieces||headers;i:=i+2;
   WHILE i<=n LOOP
    EXIT WHEN lines[i] !~ '^\s*\|.*\|\s*$';cells:=juyu.search_table_cells(lines[i]);EXIT WHEN cardinality(cells)<>cardinality(headers);
    pieces:=pieces||cells;i:=i+1;
   END LOOP;CONTINUE;
  END IF;
  heading:=regexp_match(line,'^(#{1,3})[ \t]+(.+?)\s*$');
  list_item:=regexp_match(line,'^[ \t]*(?:([-+*])|([0-9]{1,9})[.)])[ \t]+(.+)$');
  IF heading IS NOT NULL OR list_item IS NOT NULL THEN
   IF cardinality(paragraph)>0 THEN pieces:=array_append(pieces,juyu.search_inline_text(array_to_string(paragraph,E'\n')));paragraph:='{}';END IF;
   pieces:=array_append(pieces,juyu.search_inline_text(CASE WHEN heading IS NOT NULL THEN heading[2] ELSE list_item[3] END));
  ELSE paragraph:=array_append(paragraph,line);END IF;
  i:=i+1;
 END LOOP;
 IF cardinality(paragraph)>0 THEN pieces:=array_append(pieces,juyu.search_inline_text(array_to_string(paragraph,E'\n')));END IF;
 RETURN coalesce(array_to_string(pieces,E'\n'),'');
END $$;
CREATE FUNCTION juyu.search_revision_text(title text,body text,tags text[],blocks jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE body_text text:='';block jsonb;
BEGIN
 IF starts_with(body,E'JUYU_BLOCKNOTE_V1\n') THEN
  BEGIN body_text:=juyu.search_editor_text(substr(body,19)::jsonb);
  EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN body_text:='';END;
 ELSIF starts_with(body,'JUYU_BLOCKNOTE_') THEN body_text:='';
 ELSE
  body_text:=juyu.search_legacy_text(body);
  FOR block IN SELECT value FROM jsonb_array_elements(blocks) LOOP body_text:=body_text||E'\n'||juyu.search_media_text(block);END LOOP;
 END IF;
 RETURN concat_ws(E'\n',title,array_to_string(tags,E'\n'),body_text);
END $$;
CREATE TABLE juyu.revision_search (
 document_id text NOT NULL,revision_id integer NOT NULL,
 search_text text NOT NULL,folded_text text NOT NULL,grams text[] NOT NULL,
 PRIMARY KEY(document_id,revision_id),
 FOREIGN KEY(document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id) ON DELETE CASCADE
);
ALTER TABLE juyu.revision_search ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.revision_search FROM PUBLIC,juyu_runtime,juyu_context_issuer;
CREATE INDEX revision_search_grams_gin ON juyu.revision_search USING gin(grams);
CREATE FUNCTION juyu.index_search_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE display_text text;folded text;
BEGIN
 display_text:=juyu.search_revision_text(NEW.title,NEW.body,NEW.tags,NEW.content_blocks);folded:=juyu.search_fold(display_text);
 INSERT INTO juyu.revision_search VALUES(NEW.document_id,NEW.revision_id,display_text,folded,juyu.search_grams(folded));
 RETURN NEW;
END $$;
CREATE TRIGGER index_search_revision AFTER INSERT ON juyu.revisions FOR EACH ROW EXECUTE FUNCTION juyu.index_search_revision();
INSERT INTO juyu.revision_search(document_id,revision_id,search_text,folded_text,grams)
 SELECT document_id,revision_id,display_text,juyu.search_fold(display_text),juyu.search_grams(juyu.search_fold(display_text))
 FROM (SELECT r.*,juyu.search_revision_text(r.title,r.body,r.tags,r.content_blocks) AS display_text FROM juyu.revisions r) revisions;
CREATE FUNCTION juyu.search_publications(terms text[],requested_page integer)
RETURNS TABLE(id text,title text,kind text,revision integer,tags text[],search_text text,total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE query_grams text[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM juyu.current_identity()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF requested_page IS NULL OR requested_page<1 OR requested_page>999999 OR terms IS NULL OR cardinality(terms)<1
  OR cardinality(terms)>120 OR array_ndims(terms)<>1
  OR EXISTS(SELECT 1 FROM unnest(terms) term WHERE term IS NULL OR char_length(term)=0 OR char_length(term)>120 OR term ~ '[[:cntrl:]]')
  OR (SELECT sum(char_length(term)) FROM unnest(terms) term)>120 THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 SELECT coalesce(array_agg(DISTINCT gram),ARRAY[]::text[]) INTO query_grams
 FROM unnest(terms) term CROSS JOIN LATERAL unnest(juyu.search_grams(juyu.search_fold(term))) gram;
 RETURN QUERY
 WITH matches AS MATERIALIZED (
  SELECT d.id,r.title,d.kind,r.revision_id,r.tags
  FROM juyu.revision_search s JOIN juyu.documents d ON d.id=s.document_id AND d.published_revision_id=s.revision_id
  JOIN juyu.revisions r ON r.document_id=s.document_id AND r.revision_id=s.revision_id
  WHERE s.grams @> query_grams AND juyu.can_read_revision(s.document_id,s.revision_id)
   AND NOT EXISTS(SELECT 1 FROM unnest(terms) term WHERE strpos(s.folded_text,juyu.search_fold(term))=0)
 ), count_rows AS (SELECT count(*) AS n FROM matches), page_rows AS (
  SELECT * FROM matches ORDER BY matches.title COLLATE "C",matches.id COLLATE "C" LIMIT 20 OFFSET (requested_page-1)*20
 )
 SELECT p.id,p.title,p.kind,p.revision_id,p.tags,s.search_text,c.n FROM count_rows c LEFT JOIN page_rows p ON true
 LEFT JOIN juyu.revision_search s ON s.document_id=p.id AND s.revision_id=p.revision_id
 ORDER BY p.title COLLATE "C",p.id COLLATE "C";
END $$;
REVOKE ALL ON FUNCTION juyu.search_inline_text(text),juyu.search_table_cells(text),juyu.search_legacy_text(text),juyu.search_fold(text),juyu.search_grams(text),juyu.search_media_text(jsonb),juyu.search_editor_text(jsonb,integer),juyu.search_revision_text(text,text,text[],jsonb),juyu.index_search_revision(),juyu.search_publications(text[],integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.search_publications(text[],integer) TO juyu_runtime;
