-- Decorative category icons never affect category access or revision content.
CREATE TABLE juyu.category_icons (
 category_id uuid PRIMARY KEY REFERENCES juyu.categories(id),
 icon_key text CHECK(icon_key IS NULL OR icon_key IN ('book','users','shield','leaf','currency','plug','chat','file','globe','list','lightbulb')),
 current_version integer NOT NULL CHECK(current_version>0),
 updated_by text NOT NULL REFERENCES juyu.members(clerk_user_id),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE juyu.category_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.category_icons FORCE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.category_icons FROM PUBLIC,juyu_runtime,juyu_context_issuer;
GRANT SELECT ON juyu.category_icons TO juyu_runtime;
CREATE POLICY category_icons_reader ON juyu.category_icons FOR SELECT TO juyu_runtime USING(juyu.category_allowed(category_id) OR (juyu.is_admin() AND juyu.review_admin_eligible(juyu.actor_id())));
CREATE TABLE juyu.category_icon_events (
 category_id uuid NOT NULL REFERENCES juyu.categories(id),
 category_version integer NOT NULL,
 icon_key text,
 changed_by text NOT NULL REFERENCES juyu.members(clerk_user_id),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(category_id,category_version)
);
ALTER TABLE juyu.category_icon_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.category_icon_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.category_icon_events FROM PUBLIC,juyu_runtime,juyu_context_issuer;
CREATE FUNCTION juyu.set_category_icon(p_id uuid,p_version integer,p_icon text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;v integer;prior juyu.category_icon_events;
BEGIN
 IF p_id IS NULL OR p_version IS NULL OR p_version<1 OR (p_icon IS NOT NULL AND p_icon NOT IN ('book','users','shield','leaf','currency','plug','chat','file','globe','list','lightbulb')) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT current_version INTO v FROM juyu.categories WHERE id=p_id FOR UPDATE;
 IF v IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF v<>p_version THEN RAISE EXCEPTION 'CATEGORY_CONFLICT';END IF;
 SELECT * INTO prior FROM juyu.category_icon_events WHERE category_id=p_id AND category_version=v;
 IF FOUND THEN
  IF prior.icon_key IS NOT DISTINCT FROM p_icon AND prior.changed_by=who THEN RETURN p_icon;END IF;
  RAISE EXCEPTION 'CATEGORY_CONFLICT';
 END IF;
 INSERT INTO juyu.category_icons(category_id,icon_key,current_version,updated_by) VALUES(p_id,p_icon,v,who)
 ON CONFLICT(category_id) DO UPDATE SET icon_key=excluded.icon_key,current_version=excluded.current_version,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 INSERT INTO juyu.category_icon_events(category_id,category_version,icon_key,changed_by) VALUES(p_id,v,p_icon,who);
 RETURN p_icon;
END $$;
REVOKE ALL ON FUNCTION juyu.set_category_icon(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.set_category_icon(uuid,integer,text) TO juyu_runtime;
