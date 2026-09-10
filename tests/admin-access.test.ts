import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAdminAccess, adminDestination, adminOnly } from '../src/server/authentication/admin.ts';
import { RedirectUrls } from '@clerk/shared/internal/clerk-js/redirectUrls';
import { cleanLoginRedirects } from '../src/authentication/login-flow.ts';
import { loginFlow } from '../src/authentication/login-flow.ts';

const company = { status: 'verified' as const, userId: 'user_admin', email: 'admin@example.com', slackUserId: 'U12345678', slackTeamId: 'T12345678' };
const user = { id: company.userId, banned: false, locked: false, publicMetadata: { role: 'admin' }, primaryEmailAddressId: 'email_1', emailAddresses: [{ id: 'email_1', emailAddress: company.email, verification: { status: 'verified' } }] };

test('admin requires company verification before any role lookup', async () => {
  let reads = 0;
  for (const status of ['signed_out', 'unconfigured', 'unavailable'] as const) assert.deepEqual(await resolveAdminAccess({ status }, async () => { reads++; return user; }), { status });
  assert.deepEqual(await resolveAdminAccess({ status: 'denied', reason: 'account' }, async () => { reads++; return user; }), { status: 'denied' });
  assert.equal(reads, 0);
});

test('only the current exact publicMetadata admin role is permitted', async () => {
  assert.deepEqual(await resolveAdminAccess(company, async () => user), { status: 'admin', userId: user.id });
  for (const role of ['support', 'ops', 'Admin', 'superadmin', '', undefined, null, ['admin']]) assert.deepEqual(await resolveAdminAccess(company, async () => ({ ...user, publicMetadata: { role } })), { status: 'denied' });
});

test('unsafe metadata and browser role claims cannot grant admin', async () => {
  assert.deepEqual(await resolveAdminAccess(company, async () => ({ ...user, publicMetadata: {}, unsafeMetadata: { role: 'admin' }, role: 'admin', sessionClaims: { metadata: { role: 'admin' } } })), { status: 'denied' });
});

test('disabled, mismatched or changed company accounts cannot retain admin entry', async () => {
  for (const change of [{ banned: true }, { locked: true }, { id: 'user_other' }, { primaryEmailAddressId: 'missing' }, { emailAddresses: [{ ...user.emailAddresses[0], emailAddress: 'other@example.com' }] }, { emailAddresses: [{ ...user.emailAddresses[0], verification: { status: 'unverified' } }] }]) assert.deepEqual(await resolveAdminAccess(company, async () => ({ ...user, ...change })), { status: 'denied' });
});

test('role changes are re-read on the next check and failures stay generic', async () => {
  let role = 'admin', reads = 0;
  const read = async () => { reads++; return { ...user, publicMetadata: { role } }; };
  assert.equal((await resolveAdminAccess(company, read)).status, 'admin'); role = 'support';
  assert.equal((await resolveAdminAccess(company, read)).status, 'denied'); assert.equal(reads, 2);
  assert.deepEqual(await resolveAdminAccess(company, async () => { throw new Error('PRIVATE_KEY'); }), { status: 'unavailable' });
});

test('all admin page decisions use fixed destinations without accepting return URLs', () => {
  assert.equal(adminDestination({ status: 'admin', userId: user.id }), '/admin');
  assert.equal(adminDestination({ status: 'denied' }), '/admin/access-denied');
  assert.equal(adminDestination({ status: 'unavailable' }), '/admin/sign-in/error');
  for (const status of ['unconfigured', 'signed_out'] as const) assert.equal(adminDestination({ status }), '/admin/sign-in');
  assert.deepEqual(loginFlow('admin'), { signIn: '/admin/sign-in', afterSignIn: '/admin', error: '/admin/sign-in/error' });
  assert.deepEqual(loginFlow('employee'), { signIn: '/sign-in', afterSignIn: '/help-centre', error: '/sign-in/error' });
});

test('admin API denies every unqualified state before the protected operation executes', async () => {
  let operations = 0;
  for (const [status, expected] of [['signed_out', 401], ['denied', 403], ['unconfigured', 503], ['unavailable', 503]] as const) {
    const response = await adminOnly(async () => ({ status }), async () => { operations++; return { secret: true }; });
    assert.equal(response.status, expected); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.doesNotMatch(await response.text(), /secret|user_admin|PRIVATE_KEY/);
  }
  assert.equal(operations, 0);
});

test('qualified admin operation has protected responses and preserves closed database integration', async () => {
  const allowed = async () => ({ status: 'admin' as const, userId: user.id });
  const response = await adminOnly(allowed, async () => ({ contentAccess: 'not_configured' }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { contentAccess: 'not_configured' });
  const unavailable = await adminOnly(allowed, async () => { throw new Error('AUTH_NOT_CONFIGURED'); });
  assert.equal(unavailable.status, 503);
  const broken = await adminOnly(async () => { throw new Error('PRIVATE_KEY'); }, async () => ({ secret: true }));
  assert.equal(broken.status, 503); assert.doesNotMatch(await broken.text(), /PRIVATE_KEY|secret/);
});


test('login sanitization defeats actual Clerk query precedence and preserves OAuth callback state', () => {
  const origin = 'https://help.example.com';
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin } } });
  try {
    for (const audience of ['employee', 'admin'] as const) {
      const flow = loginFlow(audience);
      const input = new URL(`${origin}${flow.signIn}/sso-callback?state=keep&code=keep&__clerk_ticket=keep`);
      for (const key of ['sign_in_force_redirect_url', 'sign_up_force_redirect_url', 'sign_in_fallback_redirect_url', 'sign_up_fallback_redirect_url', 'redirect_url']) input.searchParams.append(key, '/sign-in/error');
      const options = { allowedRedirectOrigins: [origin], signInForceRedirectUrl: flow.afterSignIn, signUpForceRedirectUrl: flow.afterSignIn };
      assert.equal(new RedirectUrls(options, {}, input.searchParams).getAfterSignInUrl(), origin + '/sign-in/error');
      const clean = cleanLoginRedirects(input) ?? input;
      const actual = new RedirectUrls(options, {}, clean.searchParams);
      assert.equal(actual.getAfterSignInUrl(), origin + flow.afterSignIn);
      assert.equal(actual.getAfterSignUpUrl(), origin + flow.afterSignIn);
      assert.equal(clean.searchParams.get('state'), 'keep'); assert.equal(clean.searchParams.get('code'), 'keep'); assert.equal(clean.searchParams.get('__clerk_ticket'), 'keep');
      assert.equal(cleanLoginRedirects(clean), null);
    }
    assert.equal(cleanLoginRedirects(new URL(origin + '/help-centre?redirect_url=/other')), null);
  } finally { if (prior) Object.defineProperty(globalThis, 'window', prior); else Reflect.deleteProperty(globalThis, 'window'); }
});
