import test from 'node:test';
import assert from 'node:assert/strict';
import {editorInput} from '../src/server/editor/input.ts';
import {editorResponse} from '../src/server/editor/response.ts';
import {encodeEditorBody} from '../src/editor/document.ts';

const id='00000000-0000-4000-8000-000000000001';
const draft={expectedSequence:1,title:'测试问题',body:encodeEditorBody([]),kind:'qa',audience:'staff',tags:[],cover:null,qa:{category:'账户',position:0},categoryIds:[],customFields:[]};

test('editor rejects a missing title with a title-specific public error',async()=>{
 assert.throws(()=>editorInput({...draft,title:' '}),/INVALID_TITLE/);
 const response=await editorResponse(async()=>editorInput({...draft,title:' '}));
 assert.equal(response.status,400);
 assert.deepEqual(await response.json(),{error:'INVALID_TITLE'});
});

test('editor distinguishes invalid Q&A metadata from body and presentation errors',()=>{
 assert.throws(()=>editorInput({...draft,qa:{category:'账户',position:-1}}),/INVALID_QA/);
 assert.throws(()=>editorInput({...draft,body:'not valid blocks'}),/INVALID_BODY/);
 assert.throws(()=>editorInput({...draft,categoryIds:[id,id]}),/INVALID_CATEGORY/);
});

test('save errors explain the response and safe next action without treating validation as a network failure',async()=>{
 const {saveError}=await import('../src/editor/errors.ts');
 assert.match(saveError('INVALID_TITLE'),/标题/);
 assert.match(saveError('INVALID_QA'),/问答/);
 assert.match(saveError('INVALID_MEDIA'),/文件|图片/);
 assert.match(saveError('CONFLICT'),/另一个页面/);
 assert.match(saveError('EDITOR_UNAVAILABLE'),/服务器/);
 assert.match(saveError('NETWORK_ERROR'),/网络|连接/);
 assert.match(saveError('UNRECOGNIZED_RESPONSE'),/没有提供.*原因/);
 assert.doesNotMatch(saveError('INVALID_INPUT'),/网络/);
 assert.doesNotMatch(saveError('SAVE_FAILED'),/网络/);
});

test('local editor validation identifies the field before a request is sent',async()=>{
 const {validationError}=await import('../src/editor/errors.ts');
 assert.match(validationError('INVALID_QA'),/排序.*整数/);
 assert.match(validationError('INVALID_FIELDS'),/自定义字段/);
 assert.match(validationError('INVALID_PRESENTATION'),/标签|封面/);
 assert.match(validationError('PRIVATE_EDITOR_FILE_REQUIRED'),/上传/);
});
