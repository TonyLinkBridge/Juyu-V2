import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyticsInput} from '../src/analytics/model.ts';
const eventId='11111111-1111-4111-8111-111111111111';
const search={eventId,query:'  Domain   Name  ',page:1,total:1,results:[{documentId:'doc',revision:1}]};
test('analytics accepts only the three event contracts and normalizes search whitespace',()=>{
 assert.deepEqual(analyticsInput({kind:'view',eventId,documentId:'doc',revision:1}),{kind:'view',eventId,documentId:'doc',revision:1});
 assert.deepEqual(analyticsInput({kind:'search',...search}),{kind:'search',...search,query:'Domain Name'});
 const click={kind:'search_click',eventId:'22222222-2222-4222-8222-222222222222',documentId:'doc',revision:1,position:1,search};
 assert.deepEqual(analyticsInput(click),{...click,search:{...search,query:'Domain Name'}});
});
test('analytics rejects arbitrary actor time content nested fields and malformed bounded values',()=>{
 const view={kind:'view',eventId,documentId:'doc',revision:1};
 for(const input of [null,[],{}, {...view,actorId:'a'},{...view,occurredAt:'2030'},{...view,title:'secret'},{...view,kind:'feedback'},{...view,eventId:'bad'},{...view,revision:0},{...view,revision:1.5},{...view,documentId:' doc '},{...view,documentId:'x\n'}, {kind:'search',...search,page:0},{kind:'search',...search,page:1000000},{kind:'search',...search,total:-1},{kind:'search',...search,total:1.1},{kind:'search',...search,query:' '},{kind:'search',...search,query:'x\n'},{kind:'search',...search,query:'x'.repeat(121)},{kind:'search',...search,results:Array(21).fill(search.results[0])},{kind:'search',...search,results:[{documentId:'doc',revision:1,title:'secret'}]}, {kind:'search_click',eventId,documentId:'doc',revision:1,position:1,search:{...search,kind:'search'}}])assert.throws(()=>analyticsInput(input),/INVALID_INPUT/);
 assert.deepEqual(analyticsInput({kind:'search',...search,total:0,results:[]}),{kind:'search',...search,query:'Domain Name',total:0,results:[]});
});
