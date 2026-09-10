-- Eligibility is server-side and includes enrollment state unavailable to runtime SQL.
-- Only a currently authenticated Admin may query this bounded boolean fact.
CREATE FUNCTION juyu.review_admin_eligible(p_member text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,juyu AS $$
 SELECT juyu.is_admin() AND EXISTS(
  SELECT 1 FROM juyu.members m WHERE m.clerk_user_id=p_member AND m.observed_role='admin'
  AND m.disabled_at IS NULL AND nullif(btrim(m.verified_email),'') IS NOT NULL AND m.observed_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM juyu.member_operations o WHERE o.target_id=m.clerk_user_id AND o.status='pending')
  AND NOT EXISTS(SELECT 1 FROM juyu.role_enrollments e WHERE e.member_id=m.clerk_user_id AND e.state='pending')
 )
$$;
REVOKE ALL ON FUNCTION juyu.review_admin_eligible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION juyu.review_admin_eligible(text) TO juyu_runtime;
