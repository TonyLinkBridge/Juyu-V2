import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { testEnvironmentReport } from '../src/config/test-environment.ts';

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--development', '--clerk-production'].includes(args[0]))) throw new Error();
  const development = args[0] === '--development';
  Object.assign(process.env, { NODE_ENV: development ? 'development' : 'production' });
  const require = createRequire(import.meta.url);
  // Resolve the installed Next dependency so loading follows the same version and precedence.
  const nextRequire = createRequire(require.resolve('next/package.json'));
  const { loadEnvConfig } = nextRequire('@next/env') as typeof import('@next/env');
  let loadFailed = false;
  loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)), development, {
    info() {}, error() { loadFailed = true; },
  }, true);
  if (loadFailed) throw new Error();
  const report = testEnvironmentReport(process.env, args[0] === '--clerk-production' ? 'production' : 'test');
  console.log(JSON.stringify({ mode: process.env.NODE_ENV, ...report }, null, 2));
  process.exitCode = report.status === 'blocked' ? 1 : 0;
} catch {
  // Never print parser exceptions, supplied arguments, configuration values or connection strings.
  console.log(JSON.stringify({ status: 'blocked', issues: ['CONFIG_LOAD_FAILED'], liveChecks: 'not_run' }));
  process.exitCode = 1;
}
