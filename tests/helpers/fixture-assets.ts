import {readFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
/** Serve lazy chunks produced by standalone component fixture bundles. */
export async function fixtureAssets(page:Page,name:string){
 await page.route(`**/__${name}_assets/*.js`,async route=>{
  const filename=new URL(route.request().url()).pathname.split('/').pop()!;
  if(!/^[a-zA-Z0-9_.-]+\.js$/.test(filename))return route.abort();
  return route.fulfill({contentType:'application/javascript',body:await readFile(`output/verification/${name}-fixture/${filename}`,'utf8')});
 });
}
