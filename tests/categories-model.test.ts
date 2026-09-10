import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCategoryDefinitions,normalizeCategoryIds,parseCategoryWrite} from '../src/categories/model.ts';
import {editorInput} from '../src/server/editor/input.ts';
import {encodeEditorBody} from '../src/editor/document.ts';
import {recoverySnapshot,recoveryReadable} from '../src/editor/recovery.ts';
const id='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002';
const config={name:'账户问题',parentId:null,position:0,audience:'staff' as const,enabled:true};
const definition={...config,id,version:1};
test('category settings reject malformed keys IDs ranges and blank or controlled names',()=>{
 assert.equal(parseCategoryWrite({...config,expectedVersion:null,name:'  分类  '}).name,'分类');
 for(const patch of [{name:''},{name:'\u00a0'},{name:'x'.repeat(121)},{name:'A\nB'},{parentId:'bad'},{enabled:'true'},{audience:'support'},{position:1.5},{position:1000000},{position:-1},{extra:true},{expectedVersion:0},{expectedVersion:2147483647}])assert.throws(()=>parseCategoryWrite({...config,expectedVersion:1,...patch}));
 assert.deepEqual(normalizeCategoryDefinitions([{...definition,parentId:second}]),[{id,version:1,...config,parentId:second}]);
 for(const input of [[definition,definition],[{...definition,name:' spaced '}],[{...definition,id:'bad'}],[{...definition,version:null}],null])assert.throws(()=>normalizeCategoryDefinitions(input));
});
test('article category IDs are strict unique bounded and canonical',()=>{
 assert.deepEqual(normalizeCategoryIds(undefined),[]);assert.deepEqual(normalizeCategoryIds([second,id]),[id,second]);
 for(const input of [null,'[]',[id,id],['other'],Array.from({length:21},(_,n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`)])assert.throws(()=>normalizeCategoryIds(input));
});
test('editor request preserves omitted category membership and accepts explicit clearing',()=>{
 const body=encodeEditorBody([{id:'p',type:'paragraph',content:[]}]);const base={expectedSequence:0,title:'Title',body,kind:'article',audience:'staff',tags:[],cover:null};
 assert.equal(Object.hasOwn(editorInput(base),'categoryIds'),false);
 assert.deepEqual(editorInput({...base,categoryIds:[]}).categoryIds,[]);
 assert.deepEqual(editorInput({...base,categoryIds:[id]}).categoryIds,[id]);
 assert.throws(()=>editorInput({...base,categoryIds:[id,id]}));
});
test('recovery carries category membership and validates all referenced options',()=>{
 const snapshot={documentId:'article',title:'Title',body:'正文',sequence:4,status:'draft',lifecycle:'active',blocks:[],cover:null,tags:[],assets:[],kind:'article',audience:'staff',publishedRevision:1,categoryIds:[id],categoryOptions:[definition]};
 assert.deepEqual(recoverySnapshot(snapshot,'article',3),snapshot);
 assert.match(recoveryReadable(recoverySnapshot(snapshot,'article',3)),/目录分类：账户问题/);
 for(const patch of [{categoryIds:['unknown']},{categoryOptions:[]},{categoryOptions:[{...definition,audience:'public'}]}])assert.throws(()=>recoverySnapshot({...snapshot,...patch},'article',3));
});
