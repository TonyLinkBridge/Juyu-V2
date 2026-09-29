import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const workflowPath='.github/workflows/validate-links.yml';

test('published-link validation runs after main verification, daily and on demand',async()=>{
 const source=await readFile(workflowPath,'utf8');
 assert.match(source,/workflow_dispatch:/);
 assert.match(source,/schedule:/);
 assert.match(source,/cron:\s*['"]0 1 \* \* \*['"]/);
 assert.match(source,/workflow_run:/);
 assert.match(source,/workflows:\s*\[Verify\]/);
 assert.match(source,/branches:\s*\[main\]/);
 assert.match(source,/workflow_run\.conclusion == 'success'/);
 assert.match(source,/workflow_run\.event == 'push'/);
});

test('published-link validation uses read-only link command and required secrets',async()=>{
 const source=await readFile(workflowPath,'utf8');
 assert.match(source,/permissions:\s*\n\s+contents:\s*read/);
 assert.match(source,/run:\s*npm run validate:links/);
 for(const name of ['JUYU_DATABASE_RUNTIME_URL','JUYU_DATABASE_ISSUER_URL','JUYU_VALIDATE_LINKS_ACTOR_ID','JUYU_DATABASE_CA_CERT']){
  assert.match(source,new RegExp(`${name}:\\s*\\$\\{\\{ secrets\\.${name} \\}\\}`));
 }
 assert.doesNotMatch(source,/continue-on-error:\s*true/);
});
