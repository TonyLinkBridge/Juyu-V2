CREATE TABLE juyu.members (
  clerk_user_id text PRIMARY KEY CHECK (btrim(clerk_user_id) <> ''),
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE juyu.documents (
  id text PRIMARY KEY CHECK (btrim(id) <> ''),
  kind text NOT NULL CHECK (kind IN ('article','ops','reference','qa')),
  sequence integer NOT NULL CHECK (sequence >= 0),
  lifecycle text NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active','archived','trashed')),
  published_revision_id integer,
  workflow_revision_id integer NOT NULL,
  workflow_state text NOT NULL CHECK (workflow_state IN ('draft','in_review','changes_requested','approved','queued','published')),
  submitted_by text REFERENCES juyu.members(clerk_user_id),
  reviewer_id text REFERENCES juyu.members(clerk_user_id),
  approved_by text REFERENCES juyu.members(clerk_user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (workflow_state='draft' AND submitted_by IS NULL AND reviewer_id IS NULL AND approved_by IS NULL)
    OR (workflow_state IN ('in_review','changes_requested') AND submitted_by IS NOT NULL AND reviewer_id IS NOT NULL AND submitted_by <> reviewer_id AND approved_by IS NULL)
    OR (workflow_state IN ('approved','queued','published') AND submitted_by IS NOT NULL AND reviewer_id IS NOT NULL AND submitted_by <> reviewer_id AND approved_by IS NOT NULL AND approved_by=reviewer_id)
  ),
  CHECK (workflow_state <> 'published' OR (published_revision_id IS NOT NULL AND published_revision_id=workflow_revision_id))
);

CREATE TABLE juyu.revisions (
  document_id text NOT NULL REFERENCES juyu.documents(id),
  revision_id integer NOT NULL CHECK (revision_id > 0),
  title text NOT NULL CHECK (btrim(title) <> ''),
  body text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('staff','ops','admin')),
  author_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  editor_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (document_id, revision_id)
);
ALTER TABLE juyu.documents ADD CONSTRAINT published_revision_fk
  FOREIGN KEY (id,published_revision_id) REFERENCES juyu.revisions(document_id,revision_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE juyu.documents ADD CONSTRAINT workflow_revision_fk
  FOREIGN KEY (id,workflow_revision_id) REFERENCES juyu.revisions(document_id,revision_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE juyu.reviews (
  document_id text NOT NULL,
  submitted_sequence integer NOT NULL CHECK (submitted_sequence > 0),
  revision_id integer NOT NULL,
  submitted_by text NOT NULL REFERENCES juyu.members(clerk_user_id),
  reviewer_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  status text NOT NULL CHECK (status IN ('in_review','withdrawn','rejected','approved')),
  decided_by text REFERENCES juyu.members(clerk_user_id),
  reason text,
  submitted_at timestamptz NOT NULL,
  decided_at timestamptz,
  PRIMARY KEY (document_id,submitted_sequence),
  FOREIGN KEY (document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id),
  CHECK (submitted_by <> reviewer_id),
  CHECK (
    (status='in_review' AND decided_by IS NULL AND decided_at IS NULL AND reason IS NULL)
    OR (status='withdrawn' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND reason IS NULL)
    OR (status='approved' AND decided_by IS NOT NULL AND decided_by=reviewer_id AND decided_at IS NOT NULL AND reason IS NULL)
    OR (status='rejected' AND decided_by IS NOT NULL AND decided_by=reviewer_id AND decided_at IS NOT NULL AND reason IS NOT NULL AND btrim(reason)<>'')
  )
);
CREATE UNIQUE INDEX one_pending_review ON juyu.reviews(document_id) WHERE status='in_review';
CREATE INDEX reviews_assigned ON juyu.reviews(reviewer_id,status);

CREATE TABLE juyu.audit_log (
  document_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 0),
  action text NOT NULL CHECK (action IN ('create','edit','submit','withdraw','reassign','reject','approve','queue','publish')),
  actor_id text NOT NULL REFERENCES juyu.members(clerk_user_id),
  revision_id integer NOT NULL,
  at timestamptz NOT NULL,
  reviewer_id text REFERENCES juyu.members(clerk_user_id),
  previous_reviewer_id text REFERENCES juyu.members(clerk_user_id),
  reason text,
  PRIMARY KEY (document_id,sequence),
  FOREIGN KEY (document_id,revision_id) REFERENCES juyu.revisions(document_id,revision_id),
  CHECK ((sequence=0 AND action='create') OR (sequence>0 AND action<>'create')),
  CHECK (action<>'reject' OR (reason IS NOT NULL AND btrim(reason)<>''))
);

CREATE FUNCTION juyu.reject_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE: historical records cannot be updated or deleted'; END
$$;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON juyu.revisions
  FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON juyu.audit_log
  FOR EACH ROW EXECUTE FUNCTION juyu.reject_immutable_change();

-- A pending round may be reassigned or decided. Its completed evidence is permanent.
CREATE FUNCTION juyu.protect_review_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.status<>'in_review' THEN
    RAISE EXCEPTION 'IMMUTABLE: review history cannot be changed or deleted';
  END IF;
  IF NEW.document_id<>OLD.document_id OR NEW.submitted_sequence<>OLD.submitted_sequence
    OR NEW.revision_id<>OLD.revision_id OR NEW.submitted_by<>OLD.submitted_by OR NEW.submitted_at<>OLD.submitted_at
  THEN RAISE EXCEPTION 'IMMUTABLE: submitted review snapshot cannot be changed'; END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER preserve_review_history BEFORE UPDATE OR DELETE ON juyu.reviews
  FOR EACH ROW EXECUTE FUNCTION juyu.protect_review_history();

-- Deferred: document, revision, review and audit are written together before checking final state.
CREATE FUNCTION juyu.check_document_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d juyu.documents; r juyu.revisions; expected_review text;
BEGIN
  SELECT * INTO d FROM juyu.documents WHERE id=NEW.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO r FROM juyu.revisions WHERE document_id=d.id AND revision_id=d.workflow_revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTEGRITY: missing working revision'; END IF;
  IF d.kind='ops' AND EXISTS (SELECT 1 FROM juyu.revisions WHERE document_id=d.id AND audience='staff') THEN
    RAISE EXCEPTION 'INTEGRITY: OPS cannot be staff content';
  END IF;
  IF d.reviewer_id IN (r.author_id,r.editor_id) THEN RAISE EXCEPTION 'INTEGRITY: self review'; END IF;
  expected_review := CASE d.workflow_state WHEN 'in_review' THEN 'in_review' WHEN 'changes_requested' THEN 'rejected'
    WHEN 'approved' THEN 'approved' WHEN 'queued' THEN 'approved' WHEN 'published' THEN 'approved' ELSE NULL END;
  IF expected_review IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM juyu.reviews WHERE document_id=d.id AND revision_id=d.workflow_revision_id
      AND status=expected_review AND submitted_by=d.submitted_by AND reviewer_id=d.reviewer_id
  ) THEN RAISE EXCEPTION 'INTEGRITY: missing matching review'; END IF;
  IF d.published_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM juyu.audit_log WHERE document_id=d.id AND revision_id=d.published_revision_id AND action='publish'
  ) THEN RAISE EXCEPTION 'INTEGRITY: missing publication event'; END IF;
  IF (SELECT count(*) FROM juyu.audit_log WHERE document_id=d.id) <> d.sequence+1
    OR NOT EXISTS (SELECT 1 FROM juyu.audit_log WHERE document_id=d.id AND sequence=d.sequence AND revision_id=d.workflow_revision_id)
  THEN RAISE EXCEPTION 'INTEGRITY: missing audit sequence'; END IF;
  RETURN NULL;
END
$$;
CREATE CONSTRAINT TRIGGER document_integrity AFTER INSERT OR UPDATE ON juyu.documents
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION juyu.check_document_integrity();

ALTER TABLE juyu.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE juyu.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA juyu FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA juyu FROM PUBLIC;
