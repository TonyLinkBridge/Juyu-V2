import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';

// Unit tests must not inherit deployment credentials: route tests deliberately
// assert the behavior of an unconfigured application.
const inherited = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'CI', 'GITHUB_ACTIONS', 'FORCE_COLOR'];
const env = Object.fromEntries(inherited.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
env.NODE_ENV = 'test';

const files = readdirSync('tests').filter((name) => name.endsWith('.test.ts')).sort().map((name) => `tests/${name}`);
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], {env, stdio: 'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
