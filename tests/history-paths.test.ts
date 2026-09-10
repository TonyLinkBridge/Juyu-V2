import test from 'node:test';import assert from 'node:assert/strict';
test('historical media URLs stay scoped to their document and version without changing employee URLs',async()=>{
 const m=await import('../src/history/paths.ts').catch(()=>null);assert.equal(typeof m?.mediaAssetUrl,'function');if(!m)return;
 assert.equal(m.mediaAssetUrl('asset',true,'doc',3),'/api/admin/history/doc/versions/3/assets/asset');
 assert.equal(m.mediaAssetUrl('asset',false,'doc',3),'/api/assets/asset');
 assert.equal(m.mediaAssetUrl('asset',true,'doc'),'/api/admin/assets/asset');
 assert.equal(m.adminDiagramUrl('doc',3),'/api/admin/history/doc/versions/3/diagram');
 assert.equal(m.adminDiagramUrl('doc'),'/api/admin/media/doc/diagram');
 assert.equal(m.mediaAssetUrl('a/b',true,'d?x',3),'/api/admin/history/d%3Fx/versions/3/assets/a%2Fb');
});
