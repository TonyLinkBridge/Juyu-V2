import { clerkConfiguration } from './clerk.ts';
import { databaseConfiguration } from './database.ts';
import { inspectConfiguration, type Environment } from './readiness.ts';
import { SupabasePrivateStorage } from '../server/storage/supabase.ts';

/** Offline operator check. Only fixed codes and variable names may leave this function. */
export function testEnvironmentReport(env: Environment, clerkInstance: 'test' | 'production' = 'test') {
  const base = inspectConfiguration(env);
  const missing = new Set<string>(base.missing);
  const invalid = new Set<string>(base.invalid);
  const issues: string[] = [];
  const extra = ['JUYU_DATABASE_RUNTIME_URL', 'JUYU_DATABASE_ISSUER_URL',
    'NEXT_PUBLIC_CLERK_SIGN_IN_URL', 'NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL'];
  for (const key of extra) if (!env[key]?.trim()) missing.add(key);
  const invalidate = (...keys: string[]) => {
    for (const key of keys) if (!missing.has(key)) invalid.add(key);
  };
  if (clerkConfiguration(env) === 'invalid') {
    invalidate('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'APP_ORIGIN');
  }
  const keyMode = clerkInstance === 'production' ? 'live' : 'test';
  for (const [name, prefix] of [['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk'], ['CLERK_SECRET_KEY', 'sk']]) {
    const value = env[name]?.trim();
    if (value && !value.startsWith(`${prefix}_${keyMode}_`)) {
      const issue = clerkInstance === 'production' ? 'CLERK_PRODUCTION_KEYS_REQUIRED' : 'CLERK_TEST_PROJECT_REQUIRED';
      if (!issues.includes(issue)) issues.push(issue);
    }
  }
  if (clerkInstance === 'production' && env.APP_ORIGIN?.trim()) {
    try {
      const url = new URL(env.APP_ORIGIN);
      const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname);
      if (url.protocol !== 'https:' || !domain || url.hostname === 'vercel.app' || url.hostname.endsWith('.vercel.app')
        || url.hostname.endsWith('.localhost') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    } catch {
      invalidate('APP_ORIGIN');
      issues.push('CLERK_PRODUCTION_ORIGIN_REQUIRED');
    }
  }
  if (databaseConfiguration(env).state === 'invalid') invalidate('JUYU_DATABASE_RUNTIME_URL', 'JUYU_DATABASE_ISSUER_URL');
  // inspectConfiguration validates each company field independently; a missing Workspace
  // must not label an otherwise valid domain list invalid.
  if (env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      // The constructor validates configuration only; no storage methods are invoked.
      new SupabasePrivateStorage(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    } catch { invalidate('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'); }
  }
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: '/help-centre',
    NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: '/help-centre',
  })) if (env[key] && env[key] !== value) invalidate(key);
  return {
    status: missing.size || invalid.size || issues.length ? 'blocked' as const : 'ready_for_connection_checks' as const,
    missing: [...missing], invalid: [...invalid], issues,
    clerkInstance,
    liveChecks: 'not_run' as const,
  };
}
