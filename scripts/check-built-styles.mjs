import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
async function css(dir){const parts=await Promise.all((await readdir(dir,{withFileTypes:true})).map(async e=>e.isDirectory()?css(join(dir,e.name)):e.name.endsWith('.css')?readFile(join(dir,e.name),'utf8'):''));return parts.join('\n');}
const built=await css('.next/static');
const required=['.editor-focused','.editor-toolbar','.native-document','.juyu-confirm','.juyu-toasts'];
const missing=required.filter(selector=>!built.includes(selector));
const sandbox={globalThis:{}};
runInNewContext(await readFile('.next/server/app/admin/page_client-reference-manifest.js','utf8'),sandbox);
const manifest=Object.values(sandbox.globalThis.__RSC_MANIFEST)[0];
const adminEntries=['[project]/src/app/layout','[project]/src/app/admin/layout','[project]/src/app/admin/page'];
const adminFiles=[...new Set(adminEntries.flatMap(key=>(manifest.entryCSSFiles[key]??[]).map(file=>file.path)))];
const adminCSS=(await Promise.all(adminFiles.map(path=>readFile(join('.next',path),'utf8')))).join('\n');
const themeSwitchRules=['.inline-flex{','.items-center{','.rounded-full{','.p-1{','.overflow-hidden{','.size-6\\.5{','.text-fd-muted-foreground{','.bg-fd-accent{','.text-fd-accent-foreground{'];
const missingAdminTheme=themeSwitchRules.filter(selector=>!adminCSS.includes(selector));
if(missing.length||missingAdminTheme.length){
 if(missing.length)console.error('Built CSS is incomplete:',missing.join(', '));
 if(missingAdminTheme.length)console.error('Admin CSS is missing Fumadocs theme-switch rules:',missingAdminTheme.join(', '));
 process.exitCode=1;
}else console.log('Built CSS contains all required editor, reader, feedback and admin theme-switch rules.');
