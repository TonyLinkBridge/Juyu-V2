import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('company proof is shared only inside one server render, with fresh revocation checks on the next request',()=>{
 const result=spawnSync(process.execPath,['--conditions=react-server','--experimental-strip-types','tests/helpers/company-render.ts'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr+result.stdout);
});
