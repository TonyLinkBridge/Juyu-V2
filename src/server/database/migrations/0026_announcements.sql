-- Existing notices and receipts retain their values; legacy notices are not automatically published as feature announcements.
ALTER TABLE juyu.notifications ADD COLUMN announcement_target text CHECK(announcement_target IN('search','pdf','favorites','recent','feedback','forms','ops','reference','qa','editor','analytics','history')),
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2147483646),ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE juyu.notifications ADD CHECK(announcement_target IS NULL OR (target_document_id IS NULL AND feature_setting_id IS NULL));
ALTER TABLE juyu.notification_receipts ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2147483646);
ALTER TABLE juyu.notification_receipts DROP CONSTRAINT notification_receipts_pkey;
ALTER TABLE juyu.notification_receipts ADD PRIMARY KEY(notification_id,member_id,revision);
CREATE FUNCTION juyu.valid_announcement(config jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF jsonb_typeof(config) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(config))<>5 OR NOT config ?& ARRAY['title','body','target','audience','enabled'] THEN RETURN false;END IF;
 RETURN jsonb_typeof(config->'title')='string' AND char_length(config->>'title') BETWEEN 1 AND 120 AND config->>'title'=btrim(config->>'title',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') AND config->>'title' !~ '[[:cntrl:]]' AND config->>'title' !~ U&'[\0080-\009F]' AND jsonb_typeof(config->'body')='string' AND char_length(config->>'body') BETWEEN 1 AND 600 AND config->>'body'=btrim(config->>'body',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') AND config->>'body' !~ '[[:cntrl:]]' AND config->>'body' !~ U&'[\0080-\009F]' AND config->>'target' IN('search','pdf','favorites','recent','feedback','forms','ops','reference','qa','editor','analytics','history') AND config->>'audience' IN('staff','ops','admin') AND jsonb_typeof(config->'enabled')='boolean';
END $$;
CREATE TABLE juyu.announcement_versions(notification_id uuid NOT NULL REFERENCES juyu.notifications(id),revision integer NOT NULL CHECK(revision>0),config jsonb NOT NULL CHECK(juyu.valid_announcement(config)),changed_by text NOT NULL REFERENCES juyu.members(clerk_user_id),changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(notification_id,revision));
ALTER TABLE juyu.announcement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.announcement_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON juyu.announcement_versions FROM PUBLIC,juyu_runtime;
CREATE TRIGGER announcement_version_immutable BEFORE UPDATE OR DELETE ON juyu.announcement_versions FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();
CREATE FUNCTION juyu.announcement_feature(target text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT CASE WHEN target='pdf' THEN 'pdfExport' WHEN target IN('search','favorites','recent','feedback','forms','analytics') THEN target END $$;
CREATE FUNCTION juyu.announcement_target_allowed(target text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE role text;feature text;
BEGIN
 IF NOT juyu.navigation_member_eligible() OR target IS NULL OR target NOT IN('search','pdf','favorites','recent','feedback','forms','ops','reference','qa','editor','analytics','history') THEN RETURN false;END IF;
 SELECT i.role INTO role FROM juyu.current_identity() i;
 IF (target IN('editor','analytics','history') AND role<>'admin') OR (target='ops' AND role NOT IN('ops','admin')) THEN RETURN false;END IF;
 feature:=juyu.announcement_feature(target);RETURN feature IS NULL OR coalesce((juyu.feature_config()->'flags'->>feature)::boolean,false);
END $$;
CREATE OR REPLACE FUNCTION juyu.notification_allowed(notification uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT EXISTS(SELECT 1 FROM juyu.notifications n WHERE n.id=notification AND n.enabled AND n.starts_at<=clock_timestamp() AND (n.expires_at IS NULL OR n.expires_at>clock_timestamp()) AND juyu.audience_allowed(n.audience)
 AND (n.target_document_id IS NULL OR juyu.can_read_document(n.target_document_id))
 AND (n.feature_setting_id IS NULL OR EXISTS(SELECT 1 FROM juyu.settings s JOIN juyu.setting_versions v ON v.setting_id=s.id AND v.version=s.current_version WHERE s.id=n.feature_setting_id AND s.kind='feature_flag' AND s.enabled AND v.config->'enabled'='true'::jsonb))
 AND (n.announcement_target IS NULL OR juyu.announcement_target_allowed(n.announcement_target)))
$$;
DROP POLICY notifications_read ON juyu.notifications;
CREATE POLICY notifications_read ON juyu.notifications FOR SELECT TO juyu_runtime USING ((juyu.is_admin() AND juyu.review_admin_eligible(juyu.actor_id())) OR juyu.notification_allowed(id));
DROP POLICY receipts_read ON juyu.notification_receipts;
CREATE POLICY receipts_read ON juyu.notification_receipts FOR SELECT TO juyu_runtime USING(member_id=juyu.actor_id() AND juyu.notification_allowed(notification_id) AND revision=(SELECT n.revision FROM juyu.notifications n WHERE n.id=notification_id));
CREATE FUNCTION juyu.announcement_json(n juyu.notifications,p_seen boolean) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,juyu AS $$ SELECT jsonb_build_object('id',n.id,'revision',n.revision,'title',n.title,'body',n.body,'target',n.announcement_target,'audience',n.audience,'enabled',n.enabled,'seen',p_seen) $$;
CREATE FUNCTION juyu.read_announcements(p_admin boolean) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
BEGIN
 IF p_admin IS NULL OR NOT juyu.navigation_member_eligible() OR (p_admin AND (NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(juyu.actor_id()))) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN (SELECT coalesce(jsonb_agg(juyu.announcement_json(n,CASE WHEN p_admin THEN false ELSE r.seen_at IS NOT NULL END) ORDER BY n.updated_at DESC,n.id),'[]') FROM juyu.notifications n LEFT JOIN juyu.notification_receipts r ON r.notification_id=n.id AND r.member_id=juyu.actor_id() AND r.revision=n.revision WHERE n.announcement_target IS NOT NULL AND (p_admin OR (juyu.notification_allowed(n.id) AND r.dismissed_at IS NULL)));
END $$;
CREATE FUNCTION juyu.write_announcement(p_id uuid,p_expected integer,p_config jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE who text;n juyu.notifications;previous juyu.announcement_versions;next_revision integer;
BEGIN
 IF p_id IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=2147483646 OR NOT coalesce(juyu.valid_announcement(p_config),false) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT pg_try_advisory_xact_lock_shared(84620915) THEN RAISE EXCEPTION 'MEMBER_BUSY';END IF;
 who:=juyu.actor_id();IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF NOT pg_try_advisory_xact_lock(84620954) THEN RAISE EXCEPTION 'ANNOUNCEMENT_BUSY';END IF;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.is_admin() OR NOT juyu.review_admin_eligible(who) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO n FROM juyu.notifications WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF n.announcement_target IS NULL THEN RAISE EXCEPTION 'ANNOUNCEMENT_CONFLICT';END IF;
  SELECT * INTO previous FROM juyu.announcement_versions WHERE notification_id=p_id AND revision=n.revision;
  IF n.revision=p_expected+1 AND previous.changed_by=who AND previous.config=p_config THEN RETURN juyu.announcement_json(n,false);END IF;
  IF n.revision<>p_expected THEN RAISE EXCEPTION 'ANNOUNCEMENT_CONFLICT';END IF;next_revision:=n.revision+1;
 ELSE
  IF p_expected<>0 THEN RAISE EXCEPTION 'ANNOUNCEMENT_CONFLICT';END IF;IF(SELECT count(*) FROM juyu.notifications WHERE announcement_target IS NOT NULL)>=50 THEN RAISE EXCEPTION 'ANNOUNCEMENT_LIMIT';END IF;next_revision:=1;
 END IF;
 INSERT INTO juyu.notifications(id,title,body,audience,announcement_target,enabled,created_by,revision) VALUES(p_id,p_config->>'title',p_config->>'body',p_config->>'audience',p_config->>'target',(p_config->>'enabled')::boolean,who,next_revision)
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,audience=excluded.audience,announcement_target=excluded.announcement_target,enabled=excluded.enabled,revision=excluded.revision,updated_at=clock_timestamp() RETURNING * INTO n;
 INSERT INTO juyu.announcement_versions(notification_id,revision,config,changed_by) VALUES(p_id,next_revision,p_config,who);
 RETURN juyu.announcement_json(n,false);
END $$;
CREATE FUNCTION juyu.record_announcement_receipt(p_id uuid,p_revision integer,p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
DECLARE n juyu.notifications;r juyu.notification_receipts;who text;feature text;
BEGIN
 IF p_id IS NULL OR p_revision IS NULL OR p_revision<1 OR p_revision>=2147483647 OR p_action IS NULL OR p_action NOT IN('seen','dismiss') THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF NOT juyu.navigation_member_eligible() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;who:=juyu.actor_id();
 SELECT * INTO n FROM juyu.notifications WHERE id=p_id AND announcement_target IS NOT NULL FOR SHARE;
 IF NOT FOUND OR NOT juyu.notification_allowed(p_id) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF n.revision<>p_revision THEN RAISE EXCEPTION 'ANNOUNCEMENT_CONFLICT';END IF;
 feature:=juyu.announcement_feature(n.announcement_target);IF feature IS NOT NULL THEN PERFORM juyu.require_feature(feature);END IF;
 PERFORM clerk_user_id FROM juyu.members WHERE clerk_user_id=who FOR SHARE;
 IF NOT juyu.navigation_member_eligible() OR NOT juyu.notification_allowed(p_id) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 INSERT INTO juyu.notification_receipts(notification_id,member_id,revision,seen_at,dismissed_at) VALUES(p_id,who,p_revision,clock_timestamp(),CASE WHEN p_action='dismiss' THEN clock_timestamp() END)
 ON CONFLICT(notification_id,member_id,revision) DO UPDATE SET seen_at=coalesce(juyu.notification_receipts.seen_at,excluded.seen_at),dismissed_at=coalesce(juyu.notification_receipts.dismissed_at,excluded.dismissed_at) RETURNING * INTO r;
 RETURN jsonb_build_object('id',n.id,'revision',n.revision,'seen',true,'dismissed',r.dismissed_at IS NOT NULL,'target',n.announcement_target);
END $$;
REVOKE ALL ON FUNCTION juyu.valid_announcement(jsonb),juyu.announcement_feature(text),juyu.announcement_target_allowed(text),juyu.announcement_json(juyu.notifications,boolean),juyu.read_announcements(boolean),juyu.write_announcement(uuid,integer,jsonb),juyu.record_announcement_receipt(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.read_announcements(boolean),juyu.write_announcement(uuid,integer,jsonb),juyu.record_announcement_receipt(uuid,integer,text) TO juyu_runtime;
