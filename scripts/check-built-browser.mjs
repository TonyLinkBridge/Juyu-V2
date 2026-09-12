import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const renderRoutes=[
 'api/articles/[id]/pdf/route.js.nft.json',
 'api/articles/[id]/diagram/route.js.nft.json',
 'api/admin/media/[id]/diagram/route.js.nft.json',
 'api/admin/history/[id]/versions/[revision]/diagram/route.js.nft.json',
];
const required=[
 'node_modules/@sparticuz/chromium/bin/chromium.br',
 'node_modules/@sparticuz/chromium/bin/al2023.tar.br',
 'node_modules/@sparticuz/chromium/bin/fonts.tar.br',
 'node_modules/@sparticuz/chromium/bin/swiftshader.tar.br',
 'fonts/NotoSansSC.ttf', 'fonts/OFL.txt',
];
async function traced(route){
 const manifest=resolve('.next/server/app',route);
 return new Set(JSON.parse(await readFile(manifest,'utf8')).files.map(file=>resolve(dirname(manifest),file)));
}
for(const route of renderRoutes){
 const files=await traced(route);
 for(const name of required){
  const path=resolve(name);
  if(!files.has(path)||(await stat(path)).size===0)throw Error(`Missing browser resource in ${route}: ${name}`);
 }
}
const home=await traced('help-centre/page.js.nft.json');
if(home.has(resolve(required[0]))||home.has(resolve('fonts/NotoSansSC.ttf')))throw Error('Reader page unexpectedly carries browser rendering assets');
console.log('PDF/diagram browser and CJK font tracing: 4 routes passed; reader excludes rendering assets.');
