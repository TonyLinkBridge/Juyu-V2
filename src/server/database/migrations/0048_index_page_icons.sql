-- Index-page editors are existing member identities, so they can safely own
-- the initial icon audit entry without depending on cached account roles.
WITH seed(category_id,icon_key) AS (VALUES
 ('371570fa-617e-47f2-9b48-b77655fc94ee'::uuid,'users'::text),
 ('3ea2c76d-a0ef-4b1a-a9f5-1330788d08a6'::uuid,'globe'::text),
 ('424cbd07-0a1e-4829-a4e0-4b874cbefa0d'::uuid,'shield'::text),
 ('829c970f-b35c-4d07-8f57-3df6a7e4e14e'::uuid,'currency'::text),
 ('c39dc41b-ad1f-4bbe-8111-e9737e922c63'::uuid,'book'::text)
), inserted AS (
 INSERT INTO juyu.category_icons(category_id,icon_key,current_version,updated_by)
 SELECT seed.category_id,seed.icon_key,c.current_version,r.editor_id
 FROM seed
 JOIN juyu.categories c ON c.id=seed.category_id
 JOIN juyu.category_indexes ci ON ci.category_id=c.id
 JOIN juyu.documents d ON d.id=ci.document_id AND d.published_revision_id IS NOT NULL
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 ON CONFLICT(category_id) DO NOTHING
 RETURNING category_id,current_version,icon_key,updated_by
)
INSERT INTO juyu.category_icon_events(category_id,category_version,icon_key,changed_by)
SELECT category_id,current_version,icon_key,updated_by FROM inserted;
