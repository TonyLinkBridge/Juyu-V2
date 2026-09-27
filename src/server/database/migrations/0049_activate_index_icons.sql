-- The five production categories previously recorded an explicit no-icon
-- choice at version 1. Advance their metadata version and append the selected
-- Fumadocs icon instead of rewriting that history.
WITH seed(category_id,icon_key) AS (VALUES
 ('371570fa-617e-47f2-9b48-b77655fc94ee'::uuid,'users'::text),
 ('3ea2c76d-a0ef-4b1a-a9f5-1330788d08a6'::uuid,'globe'::text),
 ('424cbd07-0a1e-4829-a4e0-4b874cbefa0d'::uuid,'shield'::text),
 ('829c970f-b35c-4d07-8f57-3df6a7e4e14e'::uuid,'currency'::text),
 ('c39dc41b-ad1f-4bbe-8111-e9737e922c63'::uuid,'book'::text)
), advanced AS (
 UPDATE juyu.categories c SET name=c.name
 FROM seed JOIN juyu.category_icons old ON old.category_id=seed.category_id AND old.icon_key IS NULL
 WHERE c.id=seed.category_id
 RETURNING c.id,c.current_version
), changed AS (
 UPDATE juyu.category_icons ci
 SET icon_key=seed.icon_key,current_version=advanced.current_version,updated_by=r.editor_id,updated_at=clock_timestamp()
 FROM advanced
 JOIN seed ON seed.category_id=advanced.id
 JOIN juyu.category_indexes ix ON ix.category_id=advanced.id
 JOIN juyu.documents d ON d.id=ix.document_id AND d.published_revision_id IS NOT NULL
 JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
 WHERE ci.category_id=advanced.id AND ci.icon_key IS NULL
 RETURNING ci.category_id,ci.current_version,ci.icon_key,ci.updated_by
)
INSERT INTO juyu.category_icon_events(category_id,category_version,icon_key,changed_by)
SELECT category_id,current_version,icon_key,updated_by FROM changed;
