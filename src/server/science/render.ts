import {chromium} from 'playwright-core';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {validateDiagram} from '../../science/model.ts';
const require=createRequire(import.meta.url);
let active=false;const waiting:{resolve:()=>void;reject:()=>void;timer:ReturnType<typeof setTimeout>}[]=[];
async function acquire(){if(!active){active=true;return;}if(waiting.length>=16)throw new Error('流程图较多，请稍后重试。');await new Promise<void>((resolve,reject)=>{const item={resolve,reject:()=>reject(new Error('流程图等待超时，请重试。')),timer:setTimeout(()=>{const index=waiting.indexOf(item);if(index>=0)waiting.splice(index,1);item.reject();},15000)};waiting.push(item);});}
function release(){const next=waiting.shift();if(next){clearTimeout(next.timer);next.resolve();}else active=false;}
export async function diagramSVG(source:string):Promise<string>{
 validateDiagram(source);await acquire();
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 try{
  browser=await chromium.launch({headless:true,timeout:8000,...(process.env.PDF_CHROMIUM_EXECUTABLE?{executablePath:process.env.PDF_CHROMIUM_EXECUTABLE}:{})});timer=setTimeout(()=>{void browser?.close();},10000);
  const context=await browser.newContext({offline:true,serviceWorkers:'block'});await context.route('**/*',route=>route.abort());const page=await context.newPage();await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  await page.addScriptTag({path:join(dirname(require.resolve('mermaid/package.json')),'dist/mermaid.min.js')});
  const svg=await page.evaluate(async text=>{
   const mermaid=(window as unknown as {mermaid:{initialize:(o:unknown)=>void;render:(id:string,text:string)=>Promise<{svg:string}>}}).mermaid;
   mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral',htmlLabels:false,flowchart:{htmlLabels:false},maxTextSize:4000,maxEdges:60,suppressErrorRendering:true});
   return (await mermaid.render('juyu-diagram',text)).svg;
  },source);
  if(svg.length>500000||!svg.startsWith('<svg')||/<(?:script|foreignObject|image|a)\b|\b(?:href|onload|onclick)\s*=/i.test(svg))throw new Error('流程图包含不支持的内容。');return svg;
 }catch(error){const message=error instanceof Error?error.message:'流程图格式错误';throw new Error(message.replace(/^page.evaluate: /,'').slice(0,400));}
 finally{if(timer)clearTimeout(timer);await browser?.close().catch(()=>{});release();}
}
export const svgImage=(svg:string)=>`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
