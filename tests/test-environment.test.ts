import test from 'node:test';
import assert from 'node:assert/strict';
import { testEnvironmentReport } from '../src/config/test-environment.ts';

function fixture() {
  return {
    APP_ORIGIN: 'http://127.0.0.1:3211',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('example.clerk.accounts.dev$').toString('base64')}`,
    CLERK_SECRET_KEY: 'sk_test_SecretFixtureOnly',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'storageSecretFixtureOnly',
    ALLOWED_EMAIL_DOMAINS: 'example.com', ALLOWED_SLACK_TEAM_ID: 'T12345678',
    JUYU_DATABASE_RUNTIME_URL: 'postgresql://runtime:PasswordFixtureOnly@db.example.com/postgres?sslmode=verify-full',
    JUYU_DATABASE_ISSUER_URL: 'postgresql://issuer:PasswordFixtureOnly@db.example.com/postgres?sslmode=verify-full',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: '/help-centre',
    NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: '/help-centre',
  };
}

test('empty configuration lists missing names without claiming live readiness', () => {
  const report = testEnvironmentReport({});
  assert.equal(report.status, 'blocked');
  assert.ok(report.missing.includes('JUYU_DATABASE_ISSUER_URL'));
  assert.ok(report.missing.includes('CLERK_SECRET_KEY'));
  assert.equal(report.liveChecks, 'not_run');
});
test('valid format only permits connection checks and never connects', () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('NETWORK_MUST_NOT_RUN'); };
  try {
    const report = testEnvironmentReport(fixture());
    assert.equal(report.status, 'ready_for_connection_checks');
    assert.deepEqual(report.invalid, []);
    assert.equal(report.liveChecks, 'not_run');
  } finally { globalThis.fetch = original; }
});
test('strict Clerk parser rejects malformed host and mismatched modes', () => {
  for (const patch of [
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_bad' },
    { CLERK_SECRET_KEY: 'sk_live_Fixture' },
    { CLERK_SECRET_KEY: ' sk_test_Fixture' },
  ]) assert.equal(testEnvironmentReport({ ...fixture(), ...patch }).status, 'blocked');
});
test('test acceptance refuses live Clerk keys even with valid format', () => {
  const env = fixture();
  env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.replace('pk_test_', 'pk_live_');
  env.CLERK_SECRET_KEY = 'sk_live_Fixture';
  assert.ok(testEnvironmentReport(env).issues.includes('CLERK_TEST_PROJECT_REQUIRED'));
});
test('database connections need separate users, same database and strict remote TLS', () => {
  for (const value of ['', fixture().JUYU_DATABASE_RUNTIME_URL,
    'postgresql://issuer:password@db.example.com/other?sslmode=verify-full',
    'postgresql://issuer:password@db.example.com/postgres?sslmode=require']) {
    assert.equal(testEnvironmentReport({ ...fixture(), JUYU_DATABASE_ISSUER_URL: value }).status, 'blocked');
  }
});
test('storage runtime rejects insecure local origin; company rules reject wildcards and names', () => {
  for (const patch of [{ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' },
    { ALLOWED_EMAIL_DOMAINS: '*.example.com' }, { ALLOWED_SLACK_TEAM_ID: 'Company workspace' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co/storage/v1' }]) {
    assert.equal(testEnvironmentReport({ ...fixture(), ...patch }).status, 'blocked');
  }
});
test('Clerk redirects must use the application employee entry', () => {
  assert.equal(testEnvironmentReport({ ...fixture(), NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: '/admin' }).status, 'blocked');
});
test('reports never include supplied values, including malicious errors and passwords', () => {
  const env = fixture();
  env.NEXT_PUBLIC_SUPABASE_URL = 'secret-that-must-not-appear';
  env.JUYU_DATABASE_RUNTIME_URL = 'postgresql://runtime:super-secret@bad';
  const result = JSON.stringify(testEnvironmentReport(env));
  for (const secret of ['secret-that-must-not-appear', 'super-secret', 'SecretFixtureOnly', 'PasswordFixtureOnly', 'example.com', 'T12345678']) {
    assert.ok(!result.includes(secret));
  }
});

test('missing Workspace ID must not falsely reject valid company domains', () => {
  const report = testEnvironmentReport({ ...fixture(), ALLOWED_SLACK_TEAM_ID: '' });
  assert.ok(report.missing.includes('ALLOWED_SLACK_TEAM_ID'));
  assert.ok(!report.invalid.includes('ALLOWED_EMAIL_DOMAINS'));
});
function productionFixture() {
  const env = fixture();
  return { ...env, APP_ORIGIN: 'https://help.example.com',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.replace('pk_test_', 'pk_live_'),
    CLERK_SECRET_KEY: 'sk_live_Fixture' };
}
test('explicit Clerk Production check permits paired live keys without claiming connectivity', () => {
  const report = testEnvironmentReport(productionFixture(), 'production');
  assert.equal(report.status, 'ready_for_connection_checks');
  assert.equal(report.clerkInstance, 'production');
  assert.equal(report.liveChecks, 'not_run');
});
test('Clerk Production check requires live keys and a custom HTTPS application origin', () => {
  assert.equal(testEnvironmentReport({ ...fixture(), APP_ORIGIN: 'https://help.example.com' }, 'production').status, 'blocked');
  for (const origin of ['http://127.0.0.1:3211', 'https://localhost', 'https://127.0.0.1', 'https://juyu.vercel.app', 'http://help.example.com']) {
    const report = testEnvironmentReport({ ...productionFixture(), APP_ORIGIN: origin }, 'production');
    assert.equal(report.status, 'blocked');
    assert.ok(report.issues.includes('CLERK_PRODUCTION_ORIGIN_REQUIRED'));
  }
});
