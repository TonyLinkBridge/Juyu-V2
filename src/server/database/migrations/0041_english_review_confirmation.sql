-- Keep a per-review attestation. The reviewer confirms that the English draft
-- reads naturally and preserves the approved business meaning before approval.
ALTER TABLE juyu.reviews
 ADD COLUMN english_quality_confirmed boolean NOT NULL DEFAULT false;
