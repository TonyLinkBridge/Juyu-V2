export type LoginAudience = 'employee' | 'admin';
export function loginFlow(audience: LoginAudience) {
  return audience === 'admin'
    ? { signIn: '/admin/sign-in', afterSignIn: '/admin', error: '/admin/sign-in/error' }
    : { signIn: '/sign-in', afterSignIn: '/help-centre', error: '/sign-in/error' };
}

// Clerk prioritizes these query keys over the component's fixed redirect props.
export function cleanLoginRedirects(url: URL): URL | null {
  if (!/^\/(?:admin\/)?sign-in(?:\/|$)/.test(url.pathname)) return null;
  const clean = new URL(url);
  let changed = false;
  for (const key of ['sign_in_force_redirect_url', 'sign_up_force_redirect_url', 'sign_in_fallback_redirect_url', 'sign_up_fallback_redirect_url', 'redirect_url']) {
    if (clean.searchParams.has(key)) { clean.searchParams.delete(key); changed = true; }
  }
  return changed ? clean : null;
}
