import assert from 'node:assert/strict';
import { test } from 'node:test';
import { protectedResponse, unavailableAuthentication } from '../src/server/authorization/service.ts';

for(const [name,action,status] of [
  ['success',async()=>({body:'private'}),200],
  ['missing',async()=>null,404],
  ['forbidden',async()=>{throw new Error('FORBIDDEN: secret');},403],
  ['unconfigured',unavailableAuthentication,503],
  ['internal',async()=>{throw new Error('password should never be returned');},500],
] as const) test(`protected ${name} response prevents shared caching and error leakage`,async()=>{
  const response=await protectedResponse(action);
  assert.equal(response.status,status);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('vary'),'Cookie, Authorization');
  assert.doesNotMatch(await response.text(),/secret|password/);
});

test('real route entry points ignore forged role headers and remain closed before identity integration',async()=>{
  const employee=await import('../src/app/api/articles/[id]/route.ts');
  const admin=await import('../src/app/api/admin/articles/[id]/route.ts');
  const request=new Request('http://localhost/api/articles/secret',{headers:{'x-role':'admin','Authorization':'Bearer fake','Cookie':'role=admin'}});
  const asset=await import('../src/app/api/assets/[id]/route.ts');
  for(const route of [employee,admin,asset]){
    const response=await route.GET(request,{params:Promise.resolve({id:'secret'})});
    assert.equal(response.status,503);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.deepEqual(await response.json(),{error:'AUTH_NOT_CONFIGURED'});
  }
});
