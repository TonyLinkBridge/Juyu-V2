export type Environment = Record<string, string | undefined>;
export interface ConfigurationReport {
  state: 'missing' | 'invalid' | 'present';
  missing: string[];
  invalid: string[];
}

const required = [
  'APP_ORIGIN',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'ALLOWED_EMAIL_DOMAINS', 'ALLOWED_SLACK_TEAM_ID',
] as const;

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && local))
      && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}

export function inspectConfiguration(env: Environment): ConfigurationReport {
  const missing = required.filter((key) => !env[key]?.trim());
  const invalid: string[] = [];
  const check = (key: string, validate: (value: string) => boolean) => {
    const value = env[key]?.trim();
    if (value && !validate(value)) invalid.push(key);
  };
  check('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', (value) => /^pk_(test|live)_\S+$/.test(value));
  check('CLERK_SECRET_KEY', (value) => /^sk_(test|live)_\S+$/.test(value));
  const publicMode = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim().split('_')[1];
  const secretMode = env.CLERK_SECRET_KEY?.trim().split('_')[1];
  if (publicMode && secretMode && publicMode !== secretMode && !invalid.includes('CLERK_SECRET_KEY')) invalid.push('CLERK_SECRET_KEY');
  check('NEXT_PUBLIC_SUPABASE_URL', isOrigin);
  check('APP_ORIGIN', isOrigin);
  check('ALLOWED_EMAIL_DOMAINS', (value) => value.split(',').every((domain) =>
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain.trim())));
  check('ALLOWED_SLACK_TEAM_ID', (value) => /^T[A-Z0-9]{7,63}$/.test(value));
  return { state: invalid.length ? 'invalid' : missing.length ? 'missing' : 'present', missing, invalid };
}

// Presence and format checks cannot prove authentication or database connectivity.
export function getReadinessReport(env: Environment) {
  return {
    status: 'not_ready' as const,
    configuration: inspectConfiguration(env).state,
    authentication: 'not_integrated' as const,
    database: 'not_integrated' as const,
  };
}
