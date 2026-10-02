import {test} from 'node:test';
import assert from 'node:assert/strict';
const sample={attempt:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',stage:'blocked',sequence:41,reason:'uploading',online:true};
test('publication diagnostics reject private fields and malformed labels rather than forwarding arbitrary client data',async()=>{
 const mod=await import('../src/review/publication-diagnostics.ts');
 assert.deepEqual(mod.parsePublicationDiagnostic(sample),sample);
 for(const patch of [{body:'private article'},{token:'private token'},{stage:'private content'},{reason:'vendor secret'},{attempt:'private user'},{sequence:-1},{sequence:1.5},{online:'yes'},{extra:true}])assert.throws(()=>mod.parsePublicationDiagnostic({...sample,...patch}),/INVALID_INPUT/);
 for(const value of [null,[],{},'private input'])assert.throws(()=>mod.parsePublicationDiagnostic(value),/INVALID_INPUT/);
 assert.equal(mod.publicationDiagnosticReason(new Error('FORBIDDEN')),'FORBIDDEN');assert.equal(mod.publicationDiagnosticReason(new Error('private backend details')),'unknown');
});
test('publication diagnostic transport stays bounded and never blocks publication when logging fails',async()=>{
 const {PublicationDiagnostics}=await import('../src/review/publication-diagnostics-client.ts');
 const originalFetch=globalThis.fetch;const originalInfo=console.info;let requests=0;const bodies:string[]=[];
 try{console.info=()=>{};globalThis.fetch=async(_url,options)=>{requests++;bodies.push(String(options?.body));throw new Error('log unavailable');};const logger=new PublicationDiagnostics('local-editor');logger.begin();for(let i=0;i<100;i++)logger.note('blocked',41,'uploading');for(let i=0;i<100;i++)logger.note('confirm_click',41);await new Promise<void>(r=>setTimeout(r,0));assert.ok(requests>0&&requests<=24);assert.equal(bodies.filter(body=>JSON.parse(body).stage==='blocked').length,1);for(const body of bodies){const event=JSON.parse(body);assert.deepEqual(Object.keys(event).sort(),['attempt','online','reason','sequence','stage']);}const prior=requests;logger.begin();logger.note('confirm_open',42);await new Promise<void>(r=>setTimeout(r,0));assert.equal(requests,prior+1);
 }finally{globalThis.fetch=originalFetch;console.info=originalInfo;}
});
