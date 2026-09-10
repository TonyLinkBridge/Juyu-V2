import assert from 'node:assert/strict';
import {test} from 'node:test';
import {editorInput} from '../src/server/editor/input.ts';
import {encodeEditorBody} from '../src/editor/document.ts';
import {createDocument,transition} from '../src/domain/workflow.ts';
const admin={id:'a',role:'admin' as const,companyVerified:true};
const input={expectedSequence:null,title:'Question',body:encodeEditorBody([]),kind:'qa',audience:'staff',tags:[],cover:null};
test('QA metadata is normalized, retained in immutable revisions and omitted input preserves it',()=>{
 const parsed=editorInput({...input,qa:{category:'  Billing  ',position:8}});
 assert.deepEqual(parsed.qa,{category:'Billing',position:8});
 const first=createDocument({...parsed,id:'qa'},admin,'2026-09-09');
 const next=transition(first,{type:'edit',title:'Question 2',body:input.body,audience:'staff'},admin,{expectedSequence:0,now:'2026-09-10'});
 assert.deepEqual(next.revisions[1].qa,{category:'Billing',position:8});assert.deepEqual(first.revisions[0].qa,next.revisions[1].qa);
});
test('QA metadata rejects invalid fields and non-QA metadata while old input remains accepted',()=>{
 assert.equal(editorInput(input).qa,undefined);
 for(const qa of [null,[],{}, {category:'x',position:1,unknown:true},{category:'x',position:-1},{category:'x',position:1.1},{category:'x',position:1000000},{category:'x\n',position:1},{category:'x'.repeat(81),position:1},{category:'x',position:'1'}])assert.throws(()=>editorInput({...input,qa}),/INVALID/);
 assert.deepEqual(editorInput({...input,qa:{category:'😀'.repeat(80),position:999999}}).qa,{category:'😀'.repeat(80),position:999999});
 assert.throws(()=>editorInput({...input,kind:'article',qa:{category:'x',position:0}}),/INVALID/);
 assert.equal(editorInput({...input,kind:'article',qa:{category:'',position:0}}).qa,undefined);
 assert.throws(()=>createDocument({...input,id:'qa',kind:'qa',audience:'staff',qa:{category:'x',position:0}},{...admin,role:'support'},'2026-09-09'),/FORBIDDEN/);
});
