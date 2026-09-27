-- Finish the existing category presentation metadata using the actor already
-- recorded on the category or one of its current published documents.
WITH seed(category_id,icon_key) AS (VALUES
 ('371570fa-617e-47f2-9b48-b77655fc94ee'::uuid,'users'::text),
 ('3ea2c76d-a0ef-4b1a-a9f5-1330788d08a6'::uuid,'globe'::text),
 ('424cbd07-0a1e-4829-a4e0-4b874cbefa0d'::uuid,'shield'::text),
 ('829c970f-b35c-4d07-8f57-3df6a7e4e14e'::uuid,'currency'::text),
 ('c39dc41b-ad1f-4bbe-8111-e9737e922c63'::uuid,'book'::text),
 ('93135e85-3113-44ea-9ed3-9518667dc0ed'::uuid,'shield'::text)
), resolved AS (
 SELECT seed.category_id,seed.icon_key,c.current_version,coalesce(cv.changed_by,published.editor_id) AS actor_id
 FROM seed
 JOIN juyu.categories c ON c.id=seed.category_id
 LEFT JOIN juyu.category_versions cv ON cv.category_id=c.id AND cv.version=c.current_version
 LEFT JOIN LATERAL (
  SELECT r.editor_id
  FROM juyu.revision_categories rc
  JOIN juyu.documents d ON d.id=rc.document_id AND d.published_revision_id=rc.revision_id
  JOIN juyu.revisions r ON r.document_id=rc.document_id AND r.revision_id=rc.revision_id
  WHERE rc.category_id=c.id
  ORDER BY r.created_at DESC,r.document_id COLLATE "C"
  LIMIT 1
 ) published ON true
), inserted AS (
 INSERT INTO juyu.category_icons(category_id,icon_key,current_version,updated_by)
 SELECT category_id,icon_key,current_version,actor_id FROM resolved WHERE actor_id IS NOT NULL
 ON CONFLICT(category_id) DO NOTHING
 RETURNING category_id,current_version,icon_key,updated_by
)
INSERT INTO juyu.category_icon_events(category_id,category_version,icon_key,changed_by)
SELECT category_id,current_version,icon_key,updated_by FROM inserted;
