import assert from 'node:assert/strict';
import test from 'node:test';
import { companyPolicy, verifyCompanyAccount } from '../src/server/authentication/company.ts';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { companyResponse } from '../src/server/authentication/company-response.ts';
import { slackUserInfo } from '../src/server/authentication/slack.ts';

const env = { ALLOWED_EMAIL_DOMAINS: 'example.com', ALLOWED_SLACK_TEAM_ID: 'T12345678' };
const session = { status: 'signed_in' as const, userId: 'user_fixture', sessionId: 'sess_fixture' };
const user = { id: session.userId, banned: false, locked: false, primaryEmailAddressId: 'email_1', emailAddresses: [{ id: 'email_1', emailAddress: 'staff@example.com', verification: { status: 'verified' } }], externalAccounts: [{ id: 'eac_1', provider: 'oauth_slack', providerUserId: 'U12345678', emailAddress: 'staff@example.com', verification: { status: 'verified' } }] };
const token = { externalAccountId: 'eac_1', provider: 'oauth_slack', token: 'local-test-token' };
const profile = { ok: true, sub: 'U12345678', 'https://slack.com/user_id': 'U12345678', 'https://slack.com/team_id': env.ALLOWED_SLACK_TEAM_ID, email: 'staff@example.com', email_verified: true };
const provider = { user: async () => user, tokens: async () => [token], slack: async () => profile };

test('company configuration allows only exact domains and an explicit workspace ID', () => {
  assert.deepEqual(companyPolicy(env), { domains: ['example.com'], teamId: 'T12345678' });
  for (const domain of ['', '*', '*.example.com', 'https://example.com', 'person@example.com', 'example.com,']) assert.equal(companyPolicy({ ...env, ALLOWED_EMAIL_DOMAINS: domain }), null);
  for (const team of ['', 'juyu', 't12345678']) assert.equal(companyPolicy({ ...env, ALLOWED_SLACK_TEAM_ID: team }), null);
});

test('missing configuration or signed-out sessions do not contact any identity supplier', async () => {
  let calls = 0;
  const fail = async () => { calls++; throw new Error('called'); };
  const never = { user: fail, tokens: fail, slack: fail };
  assert.equal((await verifyCompanyAccount(session, {}, never)).status, 'unconfigured');
  for (const status of ['signed_out', 'unconfigured', 'unavailable'] as const) assert.deepEqual(await verifyCompanyAccount({ status }, env, never), { status });
  assert.equal(calls, 0);
});

test('matching verified Clerk and Slack identity produces company proof without role or tokens', async () => {
  assert.deepEqual(await verifyCompanyAccount(session, env, provider), { status: 'verified', userId: user.id, email: 'staff@example.com', slackUserId: 'U12345678', slackTeamId: 'T12345678' });
});

test('primary email must be verified and exactly within an allowed company domain', async () => {
  for (const email of ['staff@evil-example.com', 'staff@example.com.evil.test', 'staff@sub.example.com', 'staff@example.com@evil.test', 'staff @example.com']) {
    let tokens = 0;
    const result = await verifyCompanyAccount(session, env, { ...provider, user: async () => ({ ...user, emailAddresses: [{ ...user.emailAddresses[0], emailAddress: email }] }), tokens: async () => { tokens++; return [token]; } });
    assert.equal(result.status, 'denied'); assert.equal(tokens, 0);
  }
  assert.equal((await verifyCompanyAccount(session, env, { ...provider, user: async () => ({ ...user, emailAddresses: [{ ...user.emailAddresses[0], verification: { status: 'unverified' } }] }) })).status, 'denied');
  assert.equal((await verifyCompanyAccount(session, env, { ...provider, user: async () => ({ ...user, primaryEmailAddressId: 'missing' }) })).status, 'denied');
});

test('banned, locked and mismatched Clerk users are rejected before token retrieval', async () => {
  for (const change of [{ banned: true }, { locked: true }, { id: 'user_other' }]) assert.equal((await verifyCompanyAccount(session, env, { ...provider, user: async () => ({ ...user, ...change }) })).status, 'denied');
});

test('hand-written metadata and unsigned ID token contents cannot replace Slack verification', async () => {
  const forged = { ...user, publicMetadata: { role: 'admin', slackTeamId: env.ALLOWED_SLACK_TEAM_ID, slackVerifiedAt: '2099-01-01' } };
  assert.equal((await verifyCompanyAccount(session, env, { ...provider, user: async () => forged, tokens: async () => [] })).status, 'denied');
  assert.equal((await verifyCompanyAccount(session, env, { ...provider, user: async () => forged, tokens: async () => [{ ...token, idToken: 'forged.allowed.claims' }], slack: async () => ({ ...profile, 'https://slack.com/team_id': 'T87654321' }) })).status, 'denied');
});

test('Slack token must belong to the verified linked account; ambiguous or foreign tokens fail closed', async () => {
  for (const tokens of [[], [{ ...token, externalAccountId: 'eac_other' }], [{ ...token, provider: 'google' }], [token, token], [{ ...token, token: '' }]]) {
    let reads = 0;
    assert.equal((await verifyCompanyAccount(session, env, { ...provider, tokens: async () => tokens, slack: async () => { reads++; return profile; } })).status, 'denied');
    assert.equal(reads, 0);
  }
  for (const accounts of [[], [{ ...user.externalAccounts[0], verification: { status: 'unverified' } }], [user.externalAccounts[0], user.externalAccounts[0]]]) assert.equal((await verifyCompanyAccount(session, env, { ...provider, user: async () => ({ ...user, externalAccounts: accounts }) })).status, 'denied');
});

test('Slack must confirm workspace, subject and the same verified company email', async () => {
  for (const change of [{ ok: false, error: 'invalid_auth' }, { email_verified: false }, { email_verified: 'true' }, { email: 'other@example.com' }, { sub: 'UOTHER' }, { 'https://slack.com/user_id': 'UOTHER' }, { 'https://slack.com/team_id': 'T87654321' }]) assert.equal((await verifyCompanyAccount(session, env, { ...provider, slack: async () => ({ ...profile, ...change }) })).status, 'denied');
});

test('fresh verification observes workspace and token revocation; supplier failures do not leak secrets', async () => {
  let live = true;
  const supplier = { ...provider, slack: async () => live ? profile : { ok: false, error: 'token_revoked' } };
  assert.equal((await verifyCompanyAccount(session, env, supplier)).status, 'verified'); live = false;
  assert.equal((await verifyCompanyAccount(session, env, supplier)).status, 'denied');
  for (const broken of [{ ...provider, tokens: async () => { throw new Error('SECRET'); } }, { ...provider, slack: async () => { throw new Error('SECRET'); } }]) assert.deepEqual(await verifyCompanyAccount(session, env, broken), { status: 'unavailable' });
});

test('Slack transport uses fixed HTTPS, private headers, no cache and no redirects', async () => {
  let called = false;
  const result = await slackUserInfo('local-test-token', async (url, init) => {
    called = true; assert.equal(url, 'https://slack.com/api/openid.connect.userInfo');
    assert.equal(init?.method, 'POST'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer local-test-token');
    assert.ok(init?.signal); return Response.json(profile);
  });
  assert.equal(called, true); assert.deepEqual(result, profile);
});

test('Slack HTTP failures, malformed or oversized bodies and invalid tokens fail safely', async () => {
  for (const response of [new Response('secret', { status: 429 }), new Response('not-json'), new Response('x'.repeat(65537))]) await assert.rejects(slackUserInfo('test', async () => response), /SLACK_UNAVAILABLE/);
  let called = false;
  await assert.rejects(slackUserInfo('bad\ntoken', async () => { called = true; return Response.json(profile); }), /SLACK_UNAVAILABLE/);
  assert.equal(called, false);
});


test('company status responses do not leak identities or imply content authorization', async () => {
  const success = await verifyCompanyAccount(session, env, provider);
  for (const [result, status] of [[success, 200], [{ status: 'signed_out' }, 401], [{ status: 'denied', reason: 'account' }, 403], [{ status: 'unconfigured' }, 503], [{ status: 'unavailable' }, 503]] as const) {
    const response = companyResponse(result);
    assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { status: result.status, contentAccess: 'not_configured' });
  }
});

test('real local HTTP confirms Slack transport refuses redirects without forwarding credentials', async () => {
  let redirected = 0;
  const server = createServer((request, response) => {
    if (request.url === '/sink') { redirected++; response.end('{}'); return; }
    assert.equal(request.headers.authorization, 'Bearer local-test-token');
    assert.equal(request.method, 'POST');
    response.writeHead(302, { Location: '/sink' }); response.end();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    await assert.rejects(slackUserInfo('local-test-token', (_url, init) => fetch(`http://127.0.0.1:${address.port}/userinfo`, init)), /SLACK_UNAVAILABLE/);
    assert.equal(redirected, 0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});


test('Slack application-level outages are unavailable, while rejected credentials remain denied', async () => {
  for (const error of ['internal_error', 'service_unavailable', 'ratelimited', 'org_login_required', 'unknown_future_error']) {
    const result = await verifyCompanyAccount(session, env, { ...provider, slack: async () => ({ ok: false, error }) });
    assert.deepEqual(result, { status: 'unavailable' });
    assert.equal(companyResponse(result).status, 503);
  }
  for (const error of ['token_revoked', 'token_expired', 'invalid_auth', 'missing_scope', 'account_inactive']) assert.equal((await verifyCompanyAccount(session, env, { ...provider, slack: async () => ({ ok: false, error }) })).status, 'denied');
});
