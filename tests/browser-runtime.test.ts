import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserLaunchOptions} from '../src/server/browser/runtime.ts';

test('local PDF uses installed Playwright browser without loading a Linux package', async()=>{
 const options=await browserLaunchOptions({platform:'darwin',env:{},load:async()=>{throw Error('unexpected cloud loader');}});
 assert.equal(options.executablePath,undefined);assert.equal(options.headless,true);
});
test('explicit executable works for local PDF validation', async()=>{
 const options=await browserLaunchOptions({platform:'darwin',env:{PDF_CHROMIUM_EXECUTABLE:'/local/chromium'},load:async()=>{throw Error('unexpected cloud loader');}});
 assert.equal(options.executablePath,'/local/chromium');
});
test('Vercel PDF gets packaged Linux browser and its required launch arguments', async()=>{
 let calls=0;
 const options=await browserLaunchOptions({platform:'linux',env:{VERCEL:'1'},load:async()=>{calls++;return {args:['--no-sandbox'],executablePath:async()=>'/tmp/chromium'};}});
 assert.equal(options.executablePath,'/tmp/chromium');assert.deepEqual(options.args,['--no-sandbox']);assert.equal(calls,1);
});
test('Vercel must not inherit a developer Mac executable or silently fall back to missing browser', async()=>{
 const options=await browserLaunchOptions({platform:'linux',env:{VERCEL:'1',PDF_CHROMIUM_EXECUTABLE:'/Users/tony/Chrome'},load:async()=>({args:[],executablePath:async()=>'/tmp/chromium'})});
 assert.equal(options.executablePath,'/tmp/chromium');
 await assert.rejects(browserLaunchOptions({platform:'linux',env:{VERCEL:'1'},load:async()=>{throw Error('package unavailable');}}),/BROWSER_RUNTIME_UNAVAILABLE/);
});
