import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
async function css(dir){const parts=await Promise.all((await readdir(dir,{withFileTypes:true})).map(async e=>e.isDirectory()?css(join(dir,e.name)):e.name.endsWith('.css')?readFile(join(dir,e.name),'utf8'):''));return parts.join('\n');}
const built=await css('.next/static');
const required=['.editor-focused','.editor-toolbar','.native-document','.juyu-confirm','.juyu-toasts'];
const missing=required.filter(selector=>!built.includes(selector));
if(missing.length){console.error('Built CSS is incomplete:',missing.join(', '));process.exitCode=1;}
else console.log('Built CSS contains all required editor, reader and feedback rules.');
