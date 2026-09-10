-- Single-company deployment: all relations belong to the same private juyu dataset.
-- Company membership and per-request authorization are enforced by T010–T016, not client IDs.
CREATE TABLE juyu.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name)<>'' AND char_length(name)<=120),
  parent_id uuid REFERENCES juyu.categories(id),
  position integer NOT NULL DEFAULT 0 CHECK (position>=0),
  audience text NOT NULL DEFAULT 'staff' CHECK (audience IN ('staff','ops','admin')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id<>id)
);
CREATE INDEX categories_parent_order ON juyu.categories(parent_id,position,id);

CREATE TABLE juyu.revision_categories (
  document_id text NOT NULL,
  revision_id integer NOT NULL,
  category_id uuid NOT NULL REFERENCES juyu.categories(id),
  PRIMARY KEY (document_id,revision_id,category_id),
  FOREIGN KEY (document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id)
);
CREATE INDEX revision_categories_category ON juyu.revision_categories(category_id);

CREATE TABLE juyu.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL REFERENCES juyu.documents(id),
  uploaded_by text NOT NULL REFERENCES juyu.members(clerk_user_id),
  filename text NOT NULL CHECK (btrim(filename)<>'' AND char_length(filename)<=255),
  mime_type text NOT NULL CHECK (btrim(mime_type)<>'' AND char_length(mime_type)<=255),
  byte_size bigint NOT NULL CHECK (byte_size>=0),
  bucket text NOT NULL DEFAULT 'juyu-private' CHECK (bucket='juyu-private'),
  object_key text NOT NULL CHECK (object_key=id::text),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','quarantined','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id,id),
  UNIQUE (bucket,object_key)
);
CREATE INDEX assets_uploader ON juyu.assets(uploaded_by);
CREATE FUNCTION juyu.protect_asset_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.document_id,NEW.uploaded_by,NEW.bucket,NEW.object_key,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.document_id,OLD.uploaded_by,OLD.bucket,OLD.object_key,OLD.created_at)
  THEN RAISE EXCEPTION 'IMMUTABLE: asset ownership and object identity cannot be changed'; END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER asset_identity BEFORE UPDATE ON juyu.assets FOR EACH ROW EXECUTE FUNCTION juyu.protect_asset_identity();

CREATE TABLE juyu.revision_assets (
  document_id text NOT NULL,
  revision_id integer NOT NULL,
  asset_id uuid NOT NULL,
  usage text NOT NULL DEFAULT 'attachment' CHECK (usage IN ('attachment','inline','cover')),
  PRIMARY KEY (document_id,revision_id,asset_id,usage),
  FOREIGN KEY (document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id),
  FOREIGN KEY (document_id,asset_id) REFERENCES juyu.assets(document_id,id)
);
CREATE INDEX revision_assets_asset ON juyu.revision_assets(asset_id);
CREATE UNIQUE INDEX one_cover_per_revision ON juyu.revision_assets(document_id,revision_id) WHERE usage='cover';

CREATE TABLE juyu.favorites (
  member_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  document_id text NOT NULL REFERENCES juyu.documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id,document_id)
);
CREATE INDEX favorites_document ON juyu.favorites(document_id);

CREATE TABLE juyu.recent_views (
  member_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  document_id text NOT NULL,
  revision_id integer NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id,document_id),
  FOREIGN KEY (document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id)
);
CREATE INDEX recent_views_order ON juyu.recent_views(member_id,viewed_at DESC);
CREATE INDEX recent_views_revision ON juyu.recent_views(document_id,revision_id);

CREATE TABLE juyu.feedback (
  member_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  document_id text NOT NULL,
  revision_id integer NOT NULL,
  helpful boolean NOT NULL,
  comment text CHECK (char_length(comment)<=4000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id,document_id,revision_id),
  FOREIGN KEY (document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id)
);
CREATE INDEX feedback_revision ON juyu.feedback(document_id,revision_id);

-- Only metadata is persisted here: never article titles, bodies or search snippets.
CREATE TABLE juyu.search_queries (
  id uuid PRIMARY KEY,
  member_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  query text NOT NULL CHECK (btrim(query)<>'' AND char_length(query)<=500),
  result_count integer NOT NULL CHECK (result_count>=0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,member_id)
);
CREATE INDEX search_queries_time ON juyu.search_queries(occurred_at DESC);
CREATE INDEX search_queries_member ON juyu.search_queries(member_id,occurred_at DESC);

CREATE TABLE juyu.search_results (
  search_id uuid NOT NULL REFERENCES juyu.search_queries(id),
  position integer NOT NULL CHECK (position>0),
  document_id text NOT NULL,
  revision_id integer NOT NULL,
  PRIMARY KEY (search_id,position),
  UNIQUE (search_id,position,document_id,revision_id),
  FOREIGN KEY (document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id)
);
CREATE INDEX search_results_revision ON juyu.search_results(document_id,revision_id);

CREATE TABLE juyu.analytics_events (
  id uuid PRIMARY KEY,
  member_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  kind text NOT NULL CHECK (kind IN ('view','search_click','feedback')),
  document_id text NOT NULL,
  revision_id integer NOT NULL,
  search_id uuid,
  result_position integer,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id),
  FOREIGN KEY (search_id,member_id) REFERENCES juyu.search_queries(id,member_id),
  FOREIGN KEY (search_id,result_position,document_id,revision_id) REFERENCES juyu.search_results(search_id,position,document_id,revision_id),
  CHECK (
    (kind='search_click' AND search_id IS NOT NULL AND result_position IS NOT NULL AND result_position>0)
    OR (kind IN ('view','feedback') AND search_id IS NULL AND result_position IS NULL)
  )
);
CREATE INDEX analytics_events_kind_time ON juyu.analytics_events(kind,occurred_at DESC);
CREATE INDEX analytics_events_member ON juyu.analytics_events(member_id,occurred_at DESC);
CREATE INDEX analytics_events_revision ON juyu.analytics_events(document_id,revision_id);
CREATE INDEX analytics_events_search ON juyu.analytics_events(search_id,result_position);

-- Payload shape/field types and permitted navigation destinations are validated by T048–T053.
-- JSON is data, never evaluated as executable source.
CREATE TABLE juyu.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_-]{0,99}$'),
  kind text NOT NULL CHECK (kind IN ('field','form','navigation','feature_flag','general')),
  current_version integer NOT NULL CHECK (current_version>0),
  enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE juyu.setting_versions (
  setting_id uuid NOT NULL REFERENCES juyu.settings(id),
  version integer NOT NULL CHECK (version>0),
  config jsonb NOT NULL CHECK (jsonb_typeof(config)='object'),
  changed_by text NOT NULL REFERENCES juyu.members(clerk_user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (setting_id,version)
);
ALTER TABLE juyu.settings ADD CONSTRAINT current_setting_version_fk
  FOREIGN KEY (id,current_version) REFERENCES juyu.setting_versions(setting_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX setting_versions_actor ON juyu.setting_versions(changed_by);
CREATE TRIGGER immutable_setting_version BEFORE UPDATE OR DELETE ON juyu.setting_versions
  FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();

CREATE TABLE juyu.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (btrim(title)<>'' AND char_length(title)<=200),
  body text NOT NULL CHECK (btrim(body)<>'' AND char_length(body)<=4000),
  audience text NOT NULL DEFAULT 'staff' CHECK (audience IN ('staff','ops','admin')),
  target_document_id text REFERENCES juyu.documents(id),
  feature_setting_id uuid REFERENCES juyu.settings(id),
  enabled boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by text NOT NULL REFERENCES juyu.members(clerk_user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(target_document_id,feature_setting_id)<=1),
  CHECK (expires_at IS NULL OR expires_at>starts_at)
);
CREATE INDEX notifications_target ON juyu.notifications(target_document_id);
CREATE INDEX notifications_feature ON juyu.notifications(feature_setting_id);
CREATE INDEX notifications_creator ON juyu.notifications(created_by);
CREATE INDEX notifications_active ON juyu.notifications(starts_at DESC) WHERE enabled;

CREATE TABLE juyu.notification_receipts (
  notification_id uuid NOT NULL REFERENCES juyu.notifications(id),
  member_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  seen_at timestamptz,
  dismissed_at timestamptz,
  PRIMARY KEY (notification_id,member_id),
  CHECK (seen_at IS NOT NULL OR dismissed_at IS NOT NULL),
  CHECK (seen_at IS NULL OR dismissed_at IS NULL OR dismissed_at>=seen_at)
);
CREATE INDEX notification_receipts_member ON juyu.notification_receipts(member_id);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['categories','revision_categories','assets','revision_assets','favorites','recent_views','feedback','search_queries','search_results','analytics_events','settings','setting_versions','notifications','notification_receipts'] LOOP
    EXECUTE format('ALTER TABLE juyu.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON juyu.%I FROM PUBLIC',table_name);
  END LOOP;
END
$$;
REVOKE ALL ON FUNCTION juyu.protect_asset_identity() FROM PUBLIC;
