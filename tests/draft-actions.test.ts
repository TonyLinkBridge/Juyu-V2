import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadComponent} from './helpers/render-component.ts';
import {draftActionInput} from '../src/drafts/model.ts';
import {workspaceQuery,type WorkspaceData} from '../src/workspace/model.ts';

const html=(component:unknown,props:Record<string,unknown>)=>renderToStaticMarkup(createElement(component as ComponentType<Record<string,unknown>>,props));

test('draft action accepts discarding only with an exact saved sequence',()=>{
 assert.deepEqual(draftActionInput({expectedSequence:7}),{expectedSequence:7});
 assert.throws(()=>draftActionInput({expectedSequence:7,confirmation:'文章'}),/INVALID_INPUT/);
});

test('workspace draft rows distinguish deleting an unpublished draft from discarding a working revision',()=>{
 const {TasksList}=loadComponent('src/components/tasks/TasksList.tsx',{
  './DraftRowAction':{DraftRowAction:({publishedRevision}:{publishedRevision:number|null})=>createElement('button',null,publishedRevision===null?'删除草稿':'放弃本次修订')},
 });
 const base={kind:'article' as const,status:'draft' as const,revision:1,updatedAt:'2026-09-23T01:00:00Z',author:'Tony',editor:'Tony',submitter:null,reviewer:null,sequence:4};
 const data:WorkspaceData={query:workspaceQuery({view:'list'}),items:[
  {...base,id:'new-draft',title:'测试文章',publishedRevision:null},
  {...base,id:'working-draft',title:'如何申请信用额度？',revision:3,publishedRevision:2},
 ],counts:{draft:2,in_review:0,changes_requested:0,approved:0,queued:0,published:0},total:2,page:1,pages:1};
 const text=html(TasksList,{data});
 assert.match(text,/删除草稿/);
 assert.match(text,/放弃本次修订/);
});
