ALTER TABLE juyu.revisions ADD COLUMN content_blocks jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(content_blocks)='array' AND jsonb_array_length(content_blocks)<=40 AND octet_length(content_blocks::text)<=1500000);
CREATE TABLE juyu.upload_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,asset_id uuid NOT NULL REFERENCES juyu.assets(id),actor_id text NOT NULL REFERENCES juyu.members(clerk_user_id),status text NOT NULL,at timestamptz NOT NULL DEFAULT now());
ALTER TABLE juyu.upload_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER upload_events_immutable BEFORE UPDATE OR DELETE ON juyu.upload_events FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();
CREATE FUNCTION juyu.reserve_upload(p_id uuid,p_document text,p_filename text,p_mime text,p_size bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM juyu.documents WHERE id=p_document AND lifecycle='active' AND workflow_state<>'in_review' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 IF p_size IS NULL OR p_size<1 OR p_size>52428800 OR p_mime NOT IN ('image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm','application/pdf','text/plain','text/csv') THEN RAISE EXCEPTION 'INVALID_UPLOAD'; END IF;
 INSERT INTO juyu.assets(id,document_id,uploaded_by,filename,mime_type,byte_size,object_key) VALUES(p_id,p_document,juyu.actor_id(),p_filename,p_mime,p_size,p_id::text);
 INSERT INTO juyu.upload_events(asset_id,actor_id,status) VALUES(p_id,juyu.actor_id(),'pending');
END $$;
CREATE FUNCTION juyu.finish_upload(p_id uuid,p_ready boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT juyu.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE juyu.assets SET status=CASE WHEN p_ready THEN 'ready' ELSE 'quarantined' END WHERE id=p_id AND uploaded_by=juyu.actor_id() AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 INSERT INTO juyu.upload_events(asset_id,actor_id,status) VALUES(p_id,juyu.actor_id(),CASE WHEN p_ready THEN 'ready' ELSE 'quarantined' END);
END $$;
CREATE FUNCTION juyu.read_publication_blocks(document text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT r.content_blocks FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id WHERE d.id=document AND juyu.can_read_revision(r.document_id,r.revision_id)
$$;
REVOKE ALL ON FUNCTION juyu.reserve_upload(uuid,text,text,text,bigint),juyu.finish_upload(uuid,boolean),juyu.read_publication_blocks(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.reserve_upload(uuid,text,text,text,bigint),juyu.finish_upload(uuid,boolean),juyu.read_publication_blocks(text) TO juyu_runtime;
