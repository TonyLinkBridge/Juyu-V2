-- Preserve each reusable snapshot. Published articles pin a specific version;
-- a new library version never rewrites an already reviewed article.
ALTER TABLE juyu.reusable_fragments ADD COLUMN family_id uuid;
ALTER TABLE juyu.reusable_fragments ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 100000);
ALTER TABLE juyu.reusable_fragments ADD COLUMN source_document_id text REFERENCES juyu.documents(id);
UPDATE juyu.reusable_fragments SET family_id=id WHERE family_id IS NULL;
ALTER TABLE juyu.reusable_fragments ALTER COLUMN family_id SET NOT NULL;
CREATE UNIQUE INDEX reusable_fragment_versions ON juyu.reusable_fragments(family_id,version);
CREATE INDEX reusable_fragment_latest_family ON juyu.reusable_fragments(family_id,version DESC);
