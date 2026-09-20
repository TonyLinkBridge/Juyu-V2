import assert from 'node:assert/strict';
import {test} from 'node:test';
import {editorInput} from '../src/server/editor/input.ts';
import {encodeEditorBody} from '../src/editor/document.ts';
import {createDocument,transition} from '../src/domain/workflow.ts';

const admin={id:'a',role:'admin' as const,companyVerified:true};
const input={expectedSequence:null,title:'测试文章',body:encodeEditorBody([]),kind:'article',audience:'staff',tags:[],cover:null};

test('article description is trimmed, versioned and preserved by older edit commands',()=>{
 const parsed=editorInput({...input,description:'  一句话介绍  '});
 assert.equal(parsed.description,'一句话介绍');
 const first=createDocument({...parsed,id:'description-test'},admin,'2026-09-20');
 assert.equal(first.revisions[0].description,'一句话介绍');
 const next=transition(first,{type:'edit',title:'改名',body:input.body,audience:'staff'},admin,{expectedSequence:0,now:'2026-09-20'});
 assert.equal(next.revisions[1].description,'一句话介绍');
 assert.equal(editorInput(input).description,'');
});

test('article description rejects controls, non-text and over 300 characters',()=>{
 for(const description of ['含\n换行','x'.repeat(301),3,{},null])assert.throws(()=>editorInput({...input,description}),/INVALID_DESCRIPTION/);
 assert.equal(editorInput({...input,description:'😀'.repeat(300)}).description,'😀'.repeat(300));
});
