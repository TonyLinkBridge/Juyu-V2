import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectConfiguration, getReadinessReport } from '../src/config/readiness.ts';

const filled = {
  APP_ORIGIN: 'https://help.example.com',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_unit_fixture',
  CLERK_SECRET_KEY: 'sk_test_unit_fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://unit-fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'unit-test-private-value',
  ALLOWED_EMAIL_DOMAINS: 'example.com, internal.example.org',
  ALLOWED_SLACK_TEAM_ID: 'T0123456789',
};

test('missing configuration is reported without throwing', () => {
  const result = inspectConfiguration({});
  assert.equal(result.state, 'missing');
  assert.ok(result.missing.includes('CLERK_SECRET_KEY'));
  assert.ok(result.missing.includes('ALLOWED_EMAIL_DOMAINS'));
  assert.equal(inspectConfiguration({ ...filled, CLERK_SECRET_KEY: '  ' }).state, 'missing');
});

test('configuration presence does not claim successful service connections', () => {
  assert.equal(inspectConfiguration(filled).state, 'present');
  assert.deepEqual(getReadinessReport(filled), {
    status: 'not_ready', configuration: 'present', authentication: 'not_integrated', database: 'not_integrated',
  });
  assert.equal(getReadinessReport({}).status, 'not_ready');
});

test('wildcard, URL and email values cannot be used as allowed company domains', () => {
  for (const value of ['*', '*.example.com', 'https://example.com', 'person@example.com', 'example.com,', 'localhost']) {
    assert.ok(inspectConfiguration({ ...filled, ALLOWED_EMAIL_DOMAINS: value }).invalid.includes('ALLOWED_EMAIL_DOMAINS'));
  }
});

test('Supabase must be a secure origin or an explicit local development origin', () => {
  for (const value of ['invalid', 'http://example.com', 'https://user:pass@example.com', 'https://example.com/rest/v1', 'https://example.com?secret=value']) {
    assert.ok(inspectConfiguration({ ...filled, NEXT_PUBLIC_SUPABASE_URL: value }).invalid.includes('NEXT_PUBLIC_SUPABASE_URL'));
  }
  assert.equal(inspectConfiguration({ ...filled, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }).state, 'present');
});

test('Clerk prefixes and test/live modes must agree', () => {
  assert.ok(inspectConfiguration({ ...filled, CLERK_SECRET_KEY: 'wrong' }).invalid.includes('CLERK_SECRET_KEY'));
  assert.equal(inspectConfiguration({ ...filled, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_unit_fixture' }).state, 'invalid');
  assert.equal(inspectConfiguration({ ...filled, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_unit_fixture', CLERK_SECRET_KEY: 'sk_live_unit_fixture' }).state, 'present');
});

test('Slack workspace identifiers cannot be arbitrary names or URLs', () => {
  for (const value of ['juyu', 'https://juyu.slack.com', 't0123456789', 'T']) {
    assert.ok(inspectConfiguration({ ...filled, ALLOWED_SLACK_TEAM_ID: value }).invalid.includes('ALLOWED_SLACK_TEAM_ID'));
  }
});

test('reports never include configuration values or arbitrary environment values', () => {
  const environment = { ...filled, ANOTHER_SECRET: 'a-hidden-secret' };
  const serialized = JSON.stringify([inspectConfiguration(environment), getReadinessReport(environment)]);
  for (const value of Object.values(environment)) assert.equal(serialized.includes(value), false);
});

test('preview and mock-role environment values cannot enable authentication', () => {
  const report = getReadinessReport({ ...filled, NODE_ENV: 'production', DEMO_MODE: 'true', MOCK_ROLE: 'admin' });
  assert.equal(report.status, 'not_ready');
  assert.equal(report.authentication, 'not_integrated');
});


test('readiness includes the canonical application origin required by Clerk', () => {
  assert.equal(inspectConfiguration({ ...filled, APP_ORIGIN: '' }).state, 'missing');
  for (const value of ['https://help.example.com/path', 'http://public.example.com', 'https://user:pass@example.com']) {
    assert.ok(inspectConfiguration({ ...filled, APP_ORIGIN: value }).invalid.includes('APP_ORIGIN'));
  }
});
