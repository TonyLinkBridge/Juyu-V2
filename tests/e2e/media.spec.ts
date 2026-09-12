import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
import type {MediaEditorData} from '../../src/media/editor';
let bundle:Awaited<ReturnType<typeof navigationBrowserBundle>>;
const asset='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const initial:MediaEditorData={documentId:'media-test',title:'操作资料 · 本地示例',body:'基础正文',sequence:0,status:'draft',lifecycle:'active',blocks:[],cover:null,tags:[],assets:[{id:asset,filename:'流程截图.png',mime:'image/png',size:'1024',status:'ready'}]};
test.beforeAll(async()=>{bundle=await navigationBrowserBundle();});
async function editor(page:import('@playwright/test').Page,failed=false,seed=initial){
 let state=structuredClone(seed);const payloads:Record<string,unknown>[]=[];
 await page.route(url=>url.pathname==='/admin/media',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({mediaEditor:state})}</script><script>${bundle.script}</script></body></html>`}));
 await page.route('**/api/admin/media/media-test',route=>{const body=route.request().postDataJSON();payloads.push(body);if(failed)return route.fulfill({status:409,json:{error:'CONFLICT'}});state={...state,blocks:body.blocks,cover:body.cover,sequence:state.sequence+1};return route.fulfill({json:state});});
 await page.route('**/api/admin/assets/**',async route=>route.fulfill({contentType:'image/png',body:await readFile('tests/fixtures/article-cover.png')}));
 await page.goto('/admin/media?article=media-test');return payloads;
}
test('media editor preserves image descriptions and table cells across save, reload, reorder and removal',async({page},info)=>{
 const bodies=await editor(page);await page.getByLabel('本篇已就绪文件').selectOption(asset);await page.getByRole('button',{name:'加入图片／影片／文件',exact:true}).click();await page.getByLabel('图片替代文字').fill('核对步骤截图');await page.getByRole('button',{name:'新增表格',exact:true}).click();await page.getByLabel('第 1 行第 1 列').fill('注册');await page.getByLabel('第 1 行第 2 列').fill('先核实身份\n再确认费用');await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');
 expect(bodies[0].expectedSequence).toBe(0);await page.reload();await expect(page.getByLabel('第 1 行第 2 列')).toHaveValue('先核实身份\n再确认费用');await expect(page.getByLabel('图片替代文字')).toHaveValue('核对步骤截图');
 await page.getByRole('region',{name:'内容块 2',exact:true}).getByRole('button',{name:'上移',exact:true}).click();await page.getByRole('button',{name:'删除内容块 2',exact:true}).click();await expect(page.getByRole('status')).toContainText('历史版本及文件仍保留');await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');expect((bodies[1].blocks as unknown[]).length).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:`output/verification/media-editor-${info.project.name}.png`,fullPage:true});
});
test('failed saves retain cells and failed uploads never enter the ready file picker',async({page})=>{
 await editor(page,true);await page.getByRole('button',{name:'新增表格',exact:true}).click();await page.getByLabel('第 1 行第 1 列').fill('保留输入');await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('alert')).toContainText('另一页面');await expect(page.getByLabel('第 1 行第 1 列')).toHaveValue('保留输入');
 await page.route('**/api/admin/media/media-test/upload',route=>route.fulfill({status:503,json:{error:'MEDIA_UNAVAILABLE'}}));await page.getByLabel('上传文件', {exact:true}).setInputFiles({name:'新截图.png',mimeType:'image/png',buffer:await readFile('tests/fixtures/article-cover.png')});await expect(page.getByRole('alert')).toContainText('未确认完成');await expect(page.getByRole('option',{name:/新截图/})).toHaveCount(0);
});
test('verified upload can be selected, used as cover and saved without sending roles',async({page})=>{
 const bodies=await editor(page);let uploaded=false;const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await page.route('**/api/admin/media/media-test/upload',route=>{uploaded=true;expect(route.request().headers()['content-type']).toBe('application/octet-stream');expect(decodeURIComponent(route.request().headers()['x-file-name'])).toBe('上传示例.png');return route.fulfill({json:{id,filename:'上传示例.png',mime:'image/png',size:'1000',status:'ready'}});});
 await page.getByLabel('上传文件',{exact:true}).setInputFiles({name:'上传示例.png',mimeType:'image/png',buffer:await readFile('tests/fixtures/article-cover.png')});await expect(page.getByRole('status')).toContainText('上传并核对成功');expect(uploaded).toBe(true);await page.getByRole('combobox',{name:'文章封面',exact:true}).selectOption(id);await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');expect(Object.keys(bodies[0]).sort()).toEqual(['blocks','cover','expectedSequence']);expect((bodies[0].cover as {assetId:string}).assetId).toBe(id);
});
test('reader media uses private URLs and reports unreadable media while preserving tables',async({page},info)=>{
 const blocks=[{id:'image',type:'image',assetId:asset,caption:'图片说明 · 本地示例',alt:'业务截图'},{id:'video',type:'video',assetId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',caption:'影片说明',alt:'本地播放检查'},{id:'file',type:'file',assetId:asset,caption:'文件卡片',alt:''},{id:'table',type:'table',headers:['项目','说明'],rows:[['注册','核对费用']]}];
 await page.route(url=>url.pathname==='/help-centre',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body><div id="presentation"></div><script id="data" type="application/json">${JSON.stringify({pages:[{type:'document',id:'media-test',title:'媒体阅读 · 本地示例',href:'/help-centre?article=media-test'}],requested:'media-test',article:{id:'media-test',title:'媒体阅读 · 本地示例',revision:1,body:'正式内容示例',blocks}})}</script><script>${bundle.script}</script></body></html>`}));
 await page.route('**/api/assets/**',async route=>route.request().url().includes(asset)?route.fulfill({contentType:'image/png',body:await readFile('tests/fixtures/article-cover.png')}):route.fulfill({status:404,json:{error:'NOT_FOUND'}}));await page.goto('/help-centre');await expect(page.getByAltText('业务截图')).toHaveJSProperty('naturalWidth',400);await expect(page.getByText('影片暂时无法读取。',{exact:false})).toBeVisible();await expect(page.getByRole('cell',{name:'核对费用'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:`output/verification/media-reader-${info.project.name}.png`,fullPage:true});
});

test('oversized table inputs remain editable and recover after reducing content',async({page})=>{
 const seed=structuredClone(initial);seed.blocks=[{id:'large',type:'table',headers:Array.from({length:8},(_,i)=>`列 ${i+1}`),rows:Array.from({length:16},()=>Array(8).fill('字'.repeat(1900)))}];
 const bodies=await editor(page,false,seed);
 for(let col=1;col<=4;col++) await page.getByLabel(`第 1 行第 ${col} 列`,{exact:true}).fill('字'.repeat(2000));
 // Approach the aggregate limit through valid individual cells, then cross it.
 for(let row=2;row<=10;row++) for(let col=1;col<=8;col++) await page.getByLabel(`第 ${row} 行第 ${col} 列`,{exact:true}).fill('字'.repeat(2000));
 await expect(page.getByRole('alert')).toContainText('输入已保留');await expect(page.getByRole('button',{name:'保存草稿',exact:true})).toBeDisabled();expect(bodies).toHaveLength(0);
 await page.getByRole('button',{name:'删除行 2',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');
});

test('native video actually plays locally generated WebM bytes on both viewports',async({page})=>{
 await page.goto('/sign-in');
 const bytes=Buffer.from(await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d')!;const stream=canvas.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});const chunks:Blob[]=[];recorder.ondataavailable=e=>chunks.push(e.data);
  const stopped=new Promise<void>(resolve=>{recorder.onstop=()=>resolve();});recorder.start();let frame=0;const timer=setInterval(()=>{ctx.fillStyle=frame++%2?'#a82635':'#f1e8dd';ctx.fillRect(0,0,160,90);},50);await new Promise(resolve=>setTimeout(resolve,1000));recorder.stop();await stopped;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
 }));
 const seed=structuredClone(initial);seed.assets=[{id:asset,filename:'本地测试影片.webm',mime:'video/webm',size:String(bytes.length),status:'ready'}];seed.blocks=[{id:'video',type:'video',assetId:asset,caption:'本地合成影片',alt:'交替色块播放检查'}];await editor(page,false,seed);
 await page.route('**/api/admin/assets/**',route=>route.fulfill({contentType:'video/webm',body:bytes}));await page.reload();await page.getByText('预览内容块（未发布）',{exact:true}).click();const video=page.locator('video');await expect(video).toBeVisible();await video.evaluate(async element=>{const v=element as HTMLVideoElement;v.muted=true;await v.play();});await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);await expect(video).toHaveJSProperty('videoWidth',160);
});

test('media reload uses custom confirmation and cancellation retains changes',async({page})=>{await editor(page);await page.getByRole('button',{name:'新增表格',exact:true}).click();await page.getByLabel('第 1 行第 1 列').fill('不要丢掉');page.on('dialog',d=>d.dismiss());await page.getByRole('button',{name:'重新载入',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByLabel('第 1 行第 1 列')).toHaveValue('不要丢掉');});

test('confirmed media reload does not prompt a second native confirmation',async({page})=>{await editor(page);await page.getByRole('button',{name:'新增表格',exact:true}).click();let native=0;page.on('dialog',async d=>{native++;await d.dismiss();});await page.getByRole('button',{name:'重新载入',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认继续'}).click();await expect(page.getByLabel('第 1 行第 1 列')).toHaveCount(0);expect(native).toBe(0);});
