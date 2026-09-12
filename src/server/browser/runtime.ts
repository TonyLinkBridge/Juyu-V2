import type {LaunchOptions} from 'playwright-core';

type PackagedBrowser={args:string[];executablePath:()=>Promise<string>};
type RuntimeOptions={platform?:NodeJS.Platform;env?:Readonly<Record<string,string|undefined>>;load?:()=>Promise<PackagedBrowser>};
let packaged:Promise<PackagedBrowser>|undefined;
function loadPackagedBrowser():Promise<PackagedBrowser>{
 // Only process-wide executable resources are reused, never pages or private content.
 return packaged??=(import('@sparticuz/chromium').then(async({default:browser})=>{
  const executablePath=await browser.executablePath();
  return {args:browser.args,executablePath:async()=>executablePath};
 }).catch(error=>{packaged=undefined;throw error;}));
}
export async function browserLaunchOptions({platform=process.platform,env=process.env,load=loadPackagedBrowser}:RuntimeOptions={}):Promise<LaunchOptions>{
 const base:LaunchOptions={headless:true,timeout:15000};
 if(env.VERCEL==='1'&&platform==='linux'){
  try{
   const browser=await load();
   return {...base,args:browser.args,executablePath:await browser.executablePath()};
  }catch{
   // Never log HTML, attachments, credentials or low-level command arguments.
   console.error('[juyu-browser]',JSON.stringify({event:'runtime_unavailable',runtime:'vercel-linux'}));
   throw new Error('BROWSER_RUNTIME_UNAVAILABLE');
  }
 }
 return {...base,...(env.PDF_CHROMIUM_EXECUTABLE?{executablePath:env.PDF_CHROMIUM_EXECUTABLE}:{})};
}
