import assert from 'node:assert/strict';
import {test} from 'node:test';
import {blockAssetIds,normalizeBlocks,uploadMetadata} from '../src/media/model.ts';
import {createDocument,transition} from '../src/domain/workflow.ts';
import {adminA,now} from './fixtures.ts';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('media blocks keep order, text, cells and asset IDs while rejecting remote or malformed data',()=>{
 const blocks=[{id:'image-1',type:'image',assetId:id,caption:'说明',alt:'截图'},{id:'table-1',type:'table',headers:['项目','说明'],rows:[['注册','中文\n两行']]}];
 assert.deepEqual(normalizeBlocks(blocks),blocks);assert.throws(()=>normalizeBlocks([{...blocks[0],assetId:'https://outside.test/image'}]));assert.throws(()=>normalizeBlocks([blocks[0],blocks[0]]));assert.throws(()=>normalizeBlocks([{...blocks[1],rows:[['少一格']]}]));
});
test('theme image uses only a distinct local image asset and includes both references',()=>{
 const dark='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const image={id:'theme-image',type:'image',assetId:id,darkAssetId:dark,caption:'主题图',alt:'操作截图'};
 assert.deepEqual(normalizeBlocks([image]),[image]);
 assert.deepEqual(blockAssetIds(normalizeBlocks([image])[0]),[id,dark]);
 for(const darkAssetId of ['https://outside.test/image',id,'not-a-uuid'])assert.throws(()=>normalizeBlocks([{...image,darkAssetId}]),/INVALID_MEDIA/);
 assert.throws(()=>normalizeBlocks([{...image,type:'file'}]),/INVALID_MEDIA/);
});
test('record table presentation options survive validation and malformed options are rejected',()=>{
 const table={id:'lookup-table',type:'table',headers:['状态','说明'],rows:[['开放','可以申请'],['关闭','暂停申请']],view:'cards',searchable:true,stickyHeader:true,stickyFirstColumn:true};
 assert.deepEqual(normalizeBlocks([table]),[table]);
 for(const update of [{view:'unknown'},{searchable:'yes'},{stickyHeader:1},{stickyFirstColumn:'true'}])assert.throws(()=>normalizeBlocks([{...table,...update}]),/INVALID_MEDIA/);
});
test('ordinary edits preserve content blocks and explicit changes produce a separate draft',()=>{
 const blocks=[{id:'file-1',type:'file' as const,assetId:id,caption:'附件',alt:''}];
 let d=createDocument({id:'media',title:'正文',body:'基础文字',audience:'staff',kind:'article',blocks},adminA,now);
 d=transition(d,{type:'edit',title:'更新标题',body:'原文',audience:'staff'},adminA,{expectedSequence:0,now});assert.deepEqual(d.revisions[1].blocks,blocks);
 const next=transition(d,{type:'edit',title:'更新标题',body:'原文',audience:'staff',blocks:[]},adminA,{expectedSequence:1,now});assert.deepEqual(next.revisions[2].blocks,[]);assert.deepEqual(next.revisions[1].blocks,blocks);
});
test('upload extension, actual signature and size must agree',()=>{
 assert.equal(uploadMetadata('照片.png',Buffer.from([137,80,78,71,13,10,26,10])).mime,'image/png');
 assert.throws(()=>uploadMetadata('照片.png',Buffer.from('<script>bad</script>')));assert.throws(()=>uploadMetadata('vector.svg',Buffer.from('<svg/>')));assert.throws(()=>uploadMetadata('../a.txt',Buffer.from('hello')));
 assert.equal(uploadMetadata('说明.txt',Buffer.from('中文')).mime,'text/plain');
});

import {uploadFile} from '../src/server/media/upload.ts';
test('upload readback confirms bytes before ready; failed or forbidden uploads never look successful',async()=>{
 const png=Buffer.from([137,80,78,71,13,10,26,10]);let ready:boolean|undefined,writes=0;let corrupt=false;
 const request=()=>new Request('http://local',{method:'POST',headers:{'content-type':'application/octet-stream','x-file-name':encodeURIComponent('图片.png')},body:png});
 const deps={authorize:async()=>{},reserve:async()=>{},finish:async(_id:string,value:boolean)=>{ready=value;},storage:()=>({put:async()=>{writes++;},read:async()=>new Response(corrupt?Buffer.alloc(8):png,{headers:{'content-length':'8'}})})};
 const result=await uploadFile(request(),'a',deps);assert.equal(result.status,'ready');assert.equal(ready,true);assert.equal(writes,1);
 corrupt=true;await assert.rejects(uploadFile(request(),'a',deps));assert.equal(ready,false);
 await assert.rejects(uploadFile(request(),'a',{...deps,authorize:async()=>{throw new Error('FORBIDDEN');}}));assert.equal(writes,2);
});

test('native audio uploads keep extension signature and size validation',()=>{
 assert.equal(uploadMetadata('voice.mp3',Buffer.from('ID3sample')).mime,'audio/mpeg');assert.equal(uploadMetadata('voice.ogg',Buffer.from('OggSsample')).mime,'audio/ogg');
 assert.throws(()=>uploadMetadata('voice.mp3',Buffer.from('<script>not audio</script>')));assert.throws(()=>uploadMetadata('voice.ogg',Buffer.from('ID3wrong type')));
 assert.throws(()=>uploadMetadata('voice.mp3',Buffer.alloc(21*1024*1024)),/UPLOAD_TOO_LARGE/);
});
