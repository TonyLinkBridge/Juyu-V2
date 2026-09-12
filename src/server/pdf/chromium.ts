import {browserLaunchOptions} from '../browser/runtime.ts';
import {chromium} from 'playwright-core';
// One job per process; no remote browser service, shared context or cached private output.
let active=false;
export async function renderPDF(html:string):Promise<Buffer>{
 if(active)throw new Error('PDF_BUSY');active=true;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 try{
  browser=await chromium.launch(await browserLaunchOptions());
  timer=setTimeout(()=>{void browser?.close();},25000);
  const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block',offline:true});
  await context.route('**/*',route=>route.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);
  await page.setContent(html,{waitUntil:'load',timeout:15000});
  await page.evaluate(async()=>{await document.fonts.ready;if([...document.images].some(img=>!img.complete||img.naturalWidth===0))throw new Error('IMAGE_UNAVAILABLE');});
  return await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;text-align:center;font-size:9px;color:#666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
 }finally{if(timer)clearTimeout(timer);await browser?.close().catch(()=>{});active=false;}
}
