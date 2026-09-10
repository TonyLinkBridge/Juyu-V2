import assert from 'node:assert/strict';
import test from 'node:test';
import { clerkConfiguration } from '../src/config/clerk.ts';
import { resolveEmployeeSession, employeeDestination } from '../src/server/authentication/session.ts';
import { signOutCurrentSession } from '../src/authentication/sign-out.ts';

const env = { APP_ORIGIN: 'http://127.0.0.1:3211', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('local-fixture.clerk.accounts.dev$').toString('base64')}`, CLERK_SECRET_KEY: 'sk_test_localfixture' };
const active = { id: 'sess_fixture', userId: 'user_fixture', status: 'active' };
const provider = { current: async () => ({ sessionId: active.id, userId: active.userId }), session: async () => active };

test('Clerk configuration requires a matched key pair with a valid encoded hostname', () => {
  assert.equal(clerkConfiguration(env), 'configured');
  assert.equal(clerkConfiguration({}), 'missing');
  assert.equal(clerkConfiguration({ ...env, CLERK_SECRET_KEY: '' }), 'missing');
  for (const override of [{ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ' ' + env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }, { CLERK_SECRET_KEY: env.CLERK_SECRET_KEY + ' ' }, { APP_ORIGIN: 'http://public.example.com' }, { APP_ORIGIN: 'https://example.com/path' }, { CLERK_SECRET_KEY: 'sk_live_fixture' }, { CLERK_SECRET_KEY: 'invalid' }, { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_invalid' }, { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('https://evil.test/path$').toString('base64')}` }]) {
    assert.equal(clerkConfiguration({ ...env, ...override }), 'invalid');
  }
});

test('missing or invalid configuration does not call the identity provider', async () => {
  const never = { current: async () => { throw new Error('MUST_NOT_CALL'); }, session: async () => { throw new Error('MUST_NOT_CALL'); } };
  assert.deepEqual(await resolveEmployeeSession('missing', never), { status: 'unconfigured' });
  assert.deepEqual(await resolveEmployeeSession('invalid', never), { status: 'unconfigured' });
});

test('anonymous and incomplete identities never become signed-in sessions', async () => {
  for (const identity of [null, { userId: 'user_fixture', sessionId: null }, { userId: null, sessionId: 'sess_fixture' }]) {
    let reads = 0;
    const result = await resolveEmployeeSession('configured', { current: async () => identity, session: async () => { reads++; return active; } });
    assert.deepEqual(result, { status: 'signed_out' }); assert.equal(reads, 0);
  }
});

test('an active server session returns identity only, without trusting role or company claims', async () => {
  const result = await resolveEmployeeSession('configured', { ...provider, current: async () => ({ sessionId: active.id, userId: active.userId, role: 'admin', companyVerified: true }) });
  assert.deepEqual(result, { status: 'signed_in', sessionId: active.id, userId: active.userId });
});

test('revoked, expired, pending and mismatched sessions are rejected', async () => {
  for (const session of [null, ...['revoked', 'ended', 'expired', 'pending', 'abandoned'].map(status => ({ ...active, status })), { ...active, id: 'sess_other' }, { ...active, userId: 'user_other' }]) {
    assert.deepEqual(await resolveEmployeeSession('configured', { ...provider, session: async () => session }), { status: 'signed_out' });
  }
});

test('each new page check re-reads server session state and observes revocation', async () => {
  let status = 'active', calls = 0;
  const live = { ...provider, session: async () => { calls++; return { ...active, status }; } };
  assert.equal((await resolveEmployeeSession('configured', live)).status, 'signed_in');
  status = 'revoked';
  assert.equal((await resolveEmployeeSession('configured', live)).status, 'signed_out');
  assert.equal(calls, 2);
});

test('provider failures become a recoverable generic error without leaking secrets', async () => {
  for (const broken of [{ ...provider, current: async () => { throw new Error('private-secret'); } }, { ...provider, session: async () => { throw new Error('private-secret'); } }]) {
    assert.deepEqual(await resolveEmployeeSession('configured', broken), { status: 'unavailable' });
  }
});

test('entry destinations are fixed internal routes for all session states', () => {
  assert.equal(employeeDestination({ status: 'signed_in', userId: active.userId, sessionId: active.id }), '/help-centre');
  for (const status of ['signed_out', 'unconfigured'] as const) assert.equal(employeeDestination({ status }), '/sign-in');
  assert.equal(employeeDestination({ status: 'unavailable' }), '/sign-in/error');
});

test('logout targets only the current session with a fixed destination, and failures remain failures', async () => {
  let received: unknown;
  await signOutCurrentSession(async options => { received = options; }, 'sess_current');
  assert.deepEqual(received, { sessionId: 'sess_current', redirectUrl: '/sign-in' });
  await assert.rejects(signOutCurrentSession(async () => { throw new Error('offline'); }, 'sess_current'), /offline/);
  let called = false;
  await assert.rejects(signOutCurrentSession(async () => { called = true; }, ''), /SESSION_REQUIRED/);
  assert.equal(called, false);
});


test('admin logout uses the same current-session operation and returns to the admin login', async () => {
  let received: unknown;
  await signOutCurrentSession(async options => { received = options; }, 'sess_admin', 'admin');
  assert.deepEqual(received, { sessionId: 'sess_admin', redirectUrl: '/admin/sign-in' });
});
