ALTER TABLE juyu.feedback ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
-- Only this checked function writes feedback. No raw runtime DML privileges.
CREATE FUNCTION juyu.save_feedback(p_document text,p_revision integer,p_helpful boolean,p_comment text,p_expected integer)
RETURNS SETOF juyu.feedback LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE current_revision integer; who text; saved juyu.feedback; normalized text;
BEGIN
 who:=juyu.actor_id();
 IF who IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_revision IS NULL OR p_revision<1 OR p_helpful IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 OR char_length(coalesce(p_comment,''))>1000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 -- Serialize against publication, archive and takedown before rechecking access.
 SELECT published_revision_id INTO current_revision FROM juyu.documents WHERE id=p_document FOR SHARE;
 IF NOT FOUND OR NOT juyu.can_read_document(p_document) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF current_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'VERSION_CHANGED'; END IF;
 normalized:=nullif(btrim(coalesce(p_comment,'')),'');
 INSERT INTO juyu.feedback AS f(member_id,document_id,revision_id,helpful,comment,updated_at,version)
 SELECT who,p_document,p_revision,p_helpful,normalized,clock_timestamp(),1
 WHERE p_expected=0 OR EXISTS(SELECT 1 FROM juyu.feedback WHERE member_id=who AND document_id=p_document AND revision_id=p_revision)
 ON CONFLICT(member_id,document_id,revision_id) DO UPDATE SET
   helpful=EXCLUDED.helpful,comment=EXCLUDED.comment,
   version=CASE WHEN f.helpful=EXCLUDED.helpful AND f.comment IS NOT DISTINCT FROM EXCLUDED.comment THEN f.version ELSE f.version+1 END,
   updated_at=CASE WHEN f.helpful=EXCLUDED.helpful AND f.comment IS NOT DISTINCT FROM EXCLUDED.comment THEN f.updated_at ELSE EXCLUDED.updated_at END
 WHERE f.version=p_expected OR (f.helpful=EXCLUDED.helpful AND f.comment IS NOT DISTINCT FROM EXCLUDED.comment)
 RETURNING * INTO saved;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 RETURN NEXT saved;
END
$$;
REVOKE ALL ON FUNCTION juyu.save_feedback(text,integer,boolean,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.save_feedback(text,integer,boolean,text,integer) TO juyu_runtime;
