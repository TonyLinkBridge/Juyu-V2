-- Native BlockNote support. No revision body or permissions are rewritten.
CREATE FUNCTION juyu.search_native_inline(items jsonb,depth integer DEFAULT 0) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE item jsonb;result text:='';
BEGIN
 IF depth>2 OR jsonb_typeof(items)<>'array' THEN RETURN '';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  IF item->>'type'='text' THEN result:=result||coalesce(item->>'text','');
  ELSIF item->>'type'='link' THEN result:=result||juyu.search_native_inline(item->'content',depth+1);END IF;
 END LOOP;RETURN result;
END $$;
REVOKE ALL ON FUNCTION juyu.search_native_inline(jsonb,integer) FROM PUBLIC;
CREATE OR REPLACE FUNCTION juyu.search_editor_text(blocks jsonb,depth integer DEFAULT 0) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,juyu AS $$
DECLARE block jsonb;result text:='';part text;row_data jsonb;cell jsonb;
BEGIN
 IF depth>8 OR jsonb_typeof(blocks)<>'array' THEN RETURN '';END IF;
 FOR block IN SELECT value FROM jsonb_array_elements(blocks) LOOP
  part:='';
  IF block->>'type' IN ('paragraph','heading','bulletListItem','numberedListItem','checkListItem','toggleListItem','quote','codeBlock') THEN
   part:=juyu.search_native_inline(block->'content');
  ELSIF block->>'type'='table' THEN
   FOR row_data IN SELECT value FROM jsonb_array_elements(block->'content'->'rows') LOOP
    FOR cell IN SELECT value FROM jsonb_array_elements(row_data->'cells') LOOP
     part:=part||E'\n'||juyu.search_native_inline(CASE WHEN jsonb_typeof(cell)='array' THEN cell ELSE cell->'content' END);
    END LOOP;
   END LOOP;
  ELSIF block->>'type' IN ('image','video','audio','file') THEN part:=concat_ws(E'\n',block->'props'->>'name',block->'props'->>'caption');
  ELSIF block->>'type'='juyu' THEN part:=juyu.search_media_text((block->'props'->>'payload')::jsonb);
  END IF;
  result:=result||E'\n'||part;
  IF jsonb_typeof(block->'children')='array' THEN result:=result||juyu.search_editor_text(block->'children',depth+1);END IF;
 END LOOP;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION juyu.reserve_upload(p_id uuid,p_document text,p_filename text,p_mime text,p_size bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM juyu.documents WHERE id=p_document AND lifecycle='active' AND workflow_state<>'in_review' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 IF p_size IS NULL OR p_size<1 OR p_size>52428800 OR p_mime NOT IN ('image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm','audio/mpeg','audio/ogg','application/pdf','text/plain','text/csv') THEN RAISE EXCEPTION 'INVALID_UPLOAD'; END IF;
 INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key) VALUES(p_id,p_document,juyu.actor_id(),p_filename,p_mime,p_size,p_id::text);
 INSERT INTO juyu.upload_events(asset_id,actor_id,status) VALUES(p_id,juyu.actor_id(),'pending');
END $$;
