-- Fumadocs folder links are backed by an explicit index page. Keep that
-- relationship as publication data instead of guessing from titles or order.
CREATE TABLE juyu.category_indexes (
 category_id uuid PRIMARY KEY REFERENCES juyu.categories(id),
 document_id text NOT NULL UNIQUE REFERENCES juyu.documents(id)
);
ALTER TABLE juyu.category_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.category_indexes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.category_indexes FROM PUBLIC,juyu_runtime,juyu_context_issuer;
GRANT SELECT ON juyu.category_indexes TO juyu_runtime;
CREATE POLICY category_indexes_reader ON juyu.category_indexes FOR SELECT TO juyu_runtime
 USING(juyu.category_allowed(category_id) AND juyu.can_read_document(document_id));

-- Current member-benefit categories already have reviewed landing articles.
-- Record those exact relationships once; later publications are never inferred.
INSERT INTO juyu.category_indexes(category_id,document_id)
SELECT seed.category_id,seed.document_id
FROM (VALUES
 ('371570fa-617e-47f2-9b48-b77655fc94ee'::uuid,'db649833-7d23-4bee-98da-9adcf99d7ff1'::text),
 ('3ea2c76d-a0ef-4b1a-a9f5-1330788d08a6'::uuid,'bdae6f82-8709-405f-9f8b-499ed6ecff52'::text),
 ('424cbd07-0a1e-4829-a4e0-4b874cbefa0d'::uuid,'791accb4-72e3-40c6-808f-7ccaa8499629'::text),
 ('829c970f-b35c-4d07-8f57-3df6a7e4e14e'::uuid,'b1d78674-c9c9-4a79-8a4a-345f60920ad3'::text),
 ('c39dc41b-ad1f-4bbe-8111-e9737e922c63'::uuid,'ec326758-4e7f-4249-8199-d272c0be5dc4'::text)
) AS seed(category_id,document_id)
JOIN juyu.categories c ON c.id=seed.category_id
JOIN juyu.documents d ON d.id=seed.document_id AND d.published_revision_id IS NOT NULL
WHERE EXISTS(
 SELECT 1 FROM juyu.revision_categories rc
 WHERE rc.category_id=seed.category_id AND rc.document_id=seed.document_id AND rc.revision_id=d.published_revision_id
);

-- Icons are explicit page-tree metadata, rendered by the same Lucide family as
-- the Fumadocs documentation site. Existing administrator choices win.
WITH actor AS (
 SELECT clerk_user_id FROM juyu.members
 WHERE observed_role IN ('admin','super_admin') AND disabled_at IS NULL
 ORDER BY clerk_user_id COLLATE "C" LIMIT 1
), seed(category_id,icon_key) AS (VALUES
 ('371570fa-617e-47f2-9b48-b77655fc94ee'::uuid,'users'::text),
 ('3ea2c76d-a0ef-4b1a-a9f5-1330788d08a6'::uuid,'globe'::text),
 ('424cbd07-0a1e-4829-a4e0-4b874cbefa0d'::uuid,'shield'::text),
 ('829c970f-b35c-4d07-8f57-3df6a7e4e14e'::uuid,'currency'::text),
 ('c39dc41b-ad1f-4bbe-8111-e9737e922c63'::uuid,'book'::text),
 ('93135e85-3113-44ea-9ed3-9518667dc0ed'::uuid,'shield'::text)
), inserted AS (
 INSERT INTO juyu.category_icons(category_id,icon_key,current_version,updated_by)
 SELECT seed.category_id,seed.icon_key,c.current_version,actor.clerk_user_id
 FROM seed JOIN juyu.categories c ON c.id=seed.category_id CROSS JOIN actor
 ON CONFLICT(category_id) DO NOTHING
 RETURNING category_id,current_version,icon_key,updated_by
)
INSERT INTO juyu.category_icon_events(category_id,category_version,icon_key,changed_by)
SELECT category_id,current_version,icon_key,updated_by FROM inserted;
