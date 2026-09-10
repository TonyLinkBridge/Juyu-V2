-- Q&A display metadata belongs to each immutable revision, separately from access categories.
ALTER TABLE juyu.revisions ADD COLUMN qa_category text NOT NULL DEFAULT '' CHECK(char_length(qa_category)<=80 AND qa_category=btrim(qa_category) AND qa_category !~ '[[:cntrl:]]');
ALTER TABLE juyu.revisions ADD COLUMN qa_position integer NOT NULL DEFAULT 0 CHECK(qa_position BETWEEN 0 AND 999999);
-- Narrow Q&A discovery; existing publication and raw table permissions remain intact.
CREATE FUNCTION juyu.read_qa_publications() RETURNS TABLE(id text,title text,revision integer,tags text[],category text,"position" integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM juyu.current_identity() i JOIN juyu.members m ON m.clerk_user_id=i.member_id
  WHERE m.verified_email IS NOT NULL AND m.observed_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN QUERY
  SELECT d.id,r.title,r.revision_id,r.tags,r.qa_category,r.qa_position
  FROM juyu.documents d JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
  WHERE d.kind='qa' AND d.lifecycle='active' AND juyu.can_read_revision(d.id,r.revision_id);
END $$;
REVOKE ALL ON FUNCTION juyu.read_qa_publications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_qa_publications() TO juyu_runtime;

CREATE OR REPLACE FUNCTION juyu.restore_document_version(p_document text,p_source integer,p_expected integer)
RETURNS TABLE(document_id text,sequence integer,revision integer,source_revision integer,status text,published_revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE d juyu.documents;source juyu.revisions;who text;next_revision integer;stamp timestamptz;
BEGIN
 IF p_document IS NULL OR btrim(p_document)='' OR p_document<>btrim(p_document) OR char_length(p_document)>200 OR p_source IS NULL OR p_source<1 OR p_expected IS NULL OR p_expected<0 OR p_expected>=2147483647 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY'; END IF;
 who:=juyu.actor_id();
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('editor:'||p_document,0));
 SELECT * INTO d FROM juyu.documents WHERE id=p_document FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who ORDER BY clerk_user_id FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 -- Only the latest immutable evidence may acknowledge an exact retry.
 IF d.sequence=p_expected+1 AND d.lifecycle='active' AND d.workflow_state='draft'
  AND d.submitted_by IS NULL AND d.reviewer_id IS NULL AND d.approved_by IS NULL
  AND NOT EXISTS(SELECT 1 FROM juyu.reviews r WHERE r.document_id=p_document AND r.status='in_review')
  AND (SELECT a.sequence=d.sequence AND a.action='restore_version' AND a.actor_id=who AND a.revision_id=d.workflow_revision_id AND a.source_revision_id=p_source AND a.previous_published_revision_id IS NOT DISTINCT FROM d.published_revision_id FROM juyu.audit_log a WHERE a.document_id=p_document ORDER BY a.sequence DESC LIMIT 1)
  AND EXISTS(SELECT 1 FROM juyu.revisions r WHERE r.document_id=p_document AND r.revision_id=d.workflow_revision_id AND r.editor_id=who) THEN
  RETURN QUERY SELECT p_document,d.sequence,d.workflow_revision_id,p_source,'draft'::text,d.published_revision_id;RETURN;
 END IF;
 IF d.sequence<>p_expected THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF d.lifecycle<>'active' OR d.workflow_state='in_review' OR p_source>=d.workflow_revision_id OR EXISTS(SELECT 1 FROM juyu.reviews r WHERE r.document_id=p_document AND r.status='in_review') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 SELECT * INTO source FROM juyu.revisions r WHERE r.document_id=p_document AND r.revision_id=p_source;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM juyu.assets a WHERE a.document_id=p_document AND a.status='pending') THEN RAISE EXCEPTION 'UPLOAD_IN_PROGRESS'; END IF;
 -- Lock every source file, including attachments absent from visible media blocks.
 PERFORM a.id FROM juyu.assets a WHERE a.document_id=p_document AND EXISTS(SELECT 1 FROM juyu.revision_assets ra WHERE ra.document_id=p_document AND ra.revision_id=p_source AND ra.asset_id=a.id) ORDER BY a.id FOR SHARE;
 IF EXISTS(SELECT 1 FROM juyu.revision_assets ra LEFT JOIN juyu.assets a ON a.id=ra.asset_id AND a.document_id=ra.document_id WHERE ra.document_id=p_document AND ra.revision_id=p_source AND (a.id IS NULL OR a.status<>'ready'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(source.content_blocks) block WHERE block ? 'assetId' AND NOT EXISTS(SELECT 1 FROM juyu.revision_assets ra JOIN juyu.assets a ON a.id=ra.asset_id AND a.document_id=ra.document_id WHERE ra.document_id=p_document AND ra.revision_id=p_source AND ra.asset_id::text=block->>'assetId' AND a.status='ready')) THEN RAISE EXCEPTION 'INVALID_MEDIA'; END IF;
 SELECT max(r.revision_id) INTO next_revision FROM juyu.revisions r WHERE r.document_id=p_document;
 IF next_revision<>d.workflow_revision_id OR next_revision>=2147483647 THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 next_revision:=next_revision+1;stamp:=clock_timestamp();
 INSERT INTO juyu.revisions(document_id,revision_id,title,body,audience,author_id,editor_id,created_at,tags,cover_alt,cover_position,content_blocks,qa_category,qa_position)
 VALUES(p_document,next_revision,source.title,source.body,source.audience,source.author_id,who,stamp,source.tags,source.cover_alt,source.cover_position,source.content_blocks,source.qa_category,source.qa_position);
 INSERT INTO juyu.revision_categories(document_id,revision_id,category_id) SELECT p_document,next_revision,rc.category_id FROM juyu.revision_categories rc WHERE rc.document_id=p_document AND rc.revision_id=p_source;
 INSERT INTO juyu.revision_assets(document_id,revision_id,asset_id,usage) SELECT p_document,next_revision,ra.asset_id,ra.usage FROM juyu.revision_assets ra WHERE ra.document_id=p_document AND ra.revision_id=p_source;
 UPDATE juyu.documents SET sequence=d.sequence+1,workflow_revision_id=next_revision,workflow_state='draft',submitted_by=NULL,reviewer_id=NULL,approved_by=NULL,updated_at=stamp WHERE id=p_document;
 INSERT INTO juyu.audit_log(document_id,sequence,action,actor_id,revision_id,source_revision_id,previous_published_revision_id,at) VALUES(p_document,d.sequence+1,'restore_version',who,next_revision,p_source,d.published_revision_id,stamp);
 RETURN QUERY SELECT p_document,d.sequence+1,next_revision,p_source,'draft'::text,d.published_revision_id;
END $$;
REVOKE ALL ON FUNCTION juyu.restore_document_version(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.restore_document_version(text,integer,integer) TO juyu_runtime;
