import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contentPath} from '../src/reader/content-path.ts';
test('personal content paths enter the corresponding module directly',()=>{
 assert.equal(contentPath('article','a'),'/help-centre?article=a');
 assert.equal(contentPath('ops','a'),'/help-centre?article=a');
 assert.equal(contentPath('reference','a'),'/help-centre/reference?article=a');
 assert.equal(contentPath('qa','a'),'/help-centre/qa?question=a#qa-a');
 assert.equal(contentPath('qa','a','en'),'/help-centre/qa?question=a&lang=en#qa-a');
 assert.equal(contentPath('reference','a','en'),'/help-centre/reference?article=a&lang=en');
 assert.equal(contentPath('article','a','en'),'/help-centre?article=a&lang=en');
});
test('content IDs cannot inject extra parameters or a different destination',()=>{
 const id='中文 &?#/';for(const kind of ['article','ops','reference','qa'] as const){const url=new URL(contentPath(kind,id),'https://local');assert.equal(url.origin,'https://local');assert.equal(url.searchParams.size,1);assert.equal(url.searchParams.get(kind==='qa'?'question':'article'),id);}
});
