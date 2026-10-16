/** Local, fake-data browser acceptance using the real component and database command. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {arcBrowserBundle} from '../tests/helpers/arc-browser.ts';
import {discardDatabase} from '../tests/helpers/discard-database.ts';
import {draftActionResponse} from '../src/server/drafts/http.ts';
const h=await discardDatabase();
const examples=await Promise.all((['standard','super_admin'] as const).map(async mode=>({mode,...await h.workingDraft(mode)})));
const bundle=await arcBrowserBundle('draft-discard',`import React from 'react';import {createRoot} from 'react-dom/client';import {DraftRowAction} from ${JSON.stringify(resolve('src/components/tasks/DraftRowAction.tsx'))};const rows=JSON.parse(document.getElementById('data').textContent);function App(){return React.createElement('main',null,React.createElement('h1',null,'放弃修订 · 隔离测试'),React.createElement('p',null,'以下均为临时测试资料，与正式系统及真实草稿无关。'),rows.map(row=>React.createElement('section',{key:row.id,style:{padding:'24px',border:'1px solid #ddd',borderRadius:12,margin:'20px 0'}},React.createElement('h2',null,row.mode==='standard'?'普通二审发布':'Super Admin 直接发布'),React.createElement('p',null,'状态：'+row.status),React.createElement('p',null,'员工仍可阅读：'+row.body),React.createElement('p',null,'正式版本：'+row.publishedRevision+' · 历史版本数：'+row.history+' · 放弃记录：'+row.discards),row.status==='draft'?React.createElement(DraftRowAction,{...row,title:row.title,onCompleted:()=>window.location.reload()}):React.createElement('strong',null,'已恢复正式版；未发布修改保留在历史记录中'))));}createRoot(document.getElementById('app')).render(React.createElement(App));`);
async function rows(){return Promise.all(examples.map(async example=>{
 const d=(await h.repo.getForManagement(example.draft.id,h.author))!,reader=(await h.service(h.staff).article(d.id))!;
 return {id:d.id,mode:example.mode,title:d.revisions.at(-1)?.title,sequence:d.sequence,publishedRevision:d.publishedRevisionId,status:d.workflow.status,body:reader.body,history:d.revisions.length,discards:(await h.fixture.pool.query("SELECT count(*)::int AS n FROM juyu.audit_log WHERE document_id=$1 AND action='discard_draft'",[d.id])).rows[0].n};
}));}
const server=createServer(async(req,res)=>{try{
 if(req.method==='GET'&&req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.script);return;}
 if(req.method==='GET'&&req.url==='/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await rows()));return;}
 if(req.method==='POST'){
  const id=req.url?.match(/^\/api\/admin\/drafts\/([^/]+)\/discard$/)?.[1];assert.ok(id&&examples.some(x=>x.draft.id===id));
  let body='';for await(const chunk of req)body+=chunk;
  const response=await draftActionResponse(()=>h.service(h.author).discardDraft(id,JSON.parse(body)));
  res.statusCode=response.status;res.setHeader('Content-Type','application/json');res.end(await response.text());return;
 }
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>放弃修订 · 隔离测试</title><style>'+bundle.css+' body{font-family:Arial,sans-serif;background:#fafafa}main{max-width:900px;margin:48px auto;padding:24px}h1{font-size:28px}h2{font-size:22px;margin-bottom:16px}section p{margin:12px 0}strong{color:#177d55}</style></head><body><div id="app"></div><script id="data" type="application/json">'+JSON.stringify(await rows()).replace(/</g,'\u003c')+'</script><script src="/bundle.js"></script></body></html>');
 }catch{res.statusCode=500;res.end('ISOLATED_TEST_FAILED');}});
server.listen(3216,'127.0.0.1',()=>console.log('Isolated discard browser test: http://127.0.0.1:3216'));
async function stop(){server.close();await h.close();process.exit();}process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
