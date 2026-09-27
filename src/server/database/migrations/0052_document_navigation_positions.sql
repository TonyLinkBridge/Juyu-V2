-- Fumadocs renders documents in the order supplied by its page tree. Keep that
-- order as explicit document metadata instead of inventing child categories or
-- guessing from article titles. NULL leaves ordinary documents on the stable
-- title fallback after explicitly ordered documents.
ALTER TABLE juyu.documents
 ADD COLUMN navigation_position integer,
 ADD CONSTRAINT documents_navigation_position CHECK(navigation_position BETWEEN 1 AND 999999);

-- The runtime may receive only this one harmless value, and only for a
-- document the current request can already read. Do not broaden raw document
-- table access just to build the Fumadocs page tree.
CREATE FUNCTION juyu.read_publication_navigation_position(p_document_id text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT d.navigation_position FROM juyu.documents d
 WHERE d.id=p_document_id AND juyu.can_read_document(d.id)
$$;
REVOKE ALL ON FUNCTION juyu.read_publication_navigation_position(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_publication_navigation_position(text) TO juyu_runtime;

-- These five existing publications are peers in 会员 / 会员权益. Record the
-- requested directory order on the articles themselves; do not create a third
-- category level for them.
UPDATE juyu.documents
SET navigation_position=seed.position
FROM (VALUES
 ('db649833-7d23-4bee-98da-9adcf99d7ff1'::text,1), -- 普通会员
 ('bdae6f82-8709-405f-9f8b-499ed6ecff52'::text,2), -- 释放拍卖大客户
 ('791accb4-72e3-40c6-808f-7ccaa8499629'::text,3), -- 高级会员
 ('b1d78674-c9c9-4a79-8a4a-345f60920ad3'::text,4), -- 金牌会员
 ('ec326758-4e7f-4249-8199-d272c0be5dc4'::text,5)  -- 签约店铺（个人/企业）
) AS seed(document_id,position)
WHERE juyu.documents.id=seed.document_id;
