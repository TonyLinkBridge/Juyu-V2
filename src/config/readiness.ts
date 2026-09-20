import {databaseConfiguration} from './database.ts';
export type Environment = Record<string, string | undefined>;
export interface ConfigurationReport {
  state: 'missing' | 'invalid' | 'present';
  missing: string[];
  invalid: string[];
}

const required = [
  'APP_ORIGIN','JUYU_DATABASE_RUNTIME_URL','JUYU_DATABASE_ISSUER_URL',
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
  if(databaseConfiguration(env).state==='invalid')invalid.push('JUYU_DATABASE_RUNTIME_URL','JUYU_DATABASE_ISSUER_URL');
  return { state: invalid.length ? 'invalid' : missing.length ? 'missing' : 'present', missing, invalid };
}

export type DependencyState='not_checked'|'ok'|'failed';
export function deploymentRelease(env:Environment){
 const value=env.VERCEL_GIT_COMMIT_SHA??env.JUYU_BUILD_REVISION;
 return value&&/^[a-zA-Z0-9._-]{1,100}$/.test(value)?value:'unknown';
}
export function getReadinessReport(env:Environment,checks:{authentication:DependencyState;database:DependencyState}={authentication:'not_checked',database:'not_checked'}){
 const configuration=inspectConfiguration(env).state;
 return {status:configuration==='present'&&checks.authentication==='ok'&&checks.database==='ok'?'ready':'not_ready',configuration,...checks,release:deploymentRelease(env)};
}
