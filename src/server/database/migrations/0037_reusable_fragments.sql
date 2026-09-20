-- Fragments are private administrator templates. Insertion copies their blocks
-- into a normal article draft, so later edits cannot bypass article review.
CREATE TABLE juyu.reusable_fragments (
 id uuid PRIMARY KEY,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 blocks jsonb NOT NULL CHECK(jsonb_typeof(blocks)='array'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by text NOT NULL REFERENCES juyu.members(clerk_user_id)
);
ALTER TABLE juyu.reusable_fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.reusable_fragments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.reusable_fragments FROM PUBLIC,juyu_runtime,juyu_context_issuer;
GRANT SELECT,INSERT ON juyu.reusable_fragments TO juyu_runtime;
CREATE POLICY reusable_fragment_read ON juyu.reusable_fragments FOR SELECT TO juyu_runtime USING(juyu.is_admin());
CREATE POLICY reusable_fragment_create ON juyu.reusable_fragments FOR INSERT TO juyu_runtime WITH CHECK(juyu.is_admin() AND created_by=juyu.actor_id());
CREATE INDEX reusable_fragments_latest ON juyu.reusable_fragments(created_at DESC,id DESC);
