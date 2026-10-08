import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {prepareUserMenuFixture} from './user-menu-browser.ts';
const require=createRequire(import.meta.url);
/** Production TSX and Next CSS Modules, not re-created preview markup. */
export async function arcBrowserBundle(name:string,entry:string){
 const dir=resolve(`output/verification/${name}-fixture`);await mkdir(dir,{recursive:true});
 const cssRule=await prepareUserMenuFixture(dir);
 await writeFile(resolve(dir,'entry.js'),entry);
 const navigation=resolve(dir,'navigation.cjs');await writeFile(navigation,`exports.useRouter=()=>({push:path=>window.location.assign(path),refresh:()=>{}});`);
 const {webpack}=require('next/dist/compiled/webpack/webpack');
 await new Promise<void>((done,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:resolve(dir,'entry.js'),output:{path:dir,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.json'],modules:[resolve('node_modules')],alias:{'next/navigation':navigation}},module:{rules:[cssRule,{test:/\.tsx?$/,exclude:/node_modules/,use:resolve('tests/helpers/fixture-typescript-loader.mjs')},{test:/\.js$/,resolve:{fullySpecified:false}}]}});compiler.run((error:Error|null,stats:{hasErrors():boolean;toString():string})=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):done()));});
 const built=await Promise.all((await readdir('.next/static/chunks')).filter(n=>n.endsWith('.css')).map(n=>readFile(`.next/static/chunks/${n}`,'utf8')));
 return {script:await readFile(resolve(dir,'bundle.js'),'utf8'),css:built.join('\n')+await readFile('src/app/globals.css','utf8')+await readFile('src/app/admin/admin-data.css','utf8')+await readFile('src/app/loading.css','utf8')};
}
export async function prepareArcSources(dir:string){
 const ts=(await import('typescript')).default;
 for(const sub of ['components/ui/arc','components/ui/user-menu']){
  const files=await readdir(resolve('src',sub),{recursive:true});
  for(const file of files){if(!/\.(tsx?|css)$/.test(file))continue;const src=resolve('src',sub,file),target=resolve(dir,sub,file.replace(/\.tsx?$/,'.js'));await mkdir(resolve(target,'..'),{recursive:true});const source=await readFile(src,'utf8');await writeFile(target,file.endsWith('.css')?source:ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,rewriteRelativeImportExtensions:true}}).outputText);}
 }
 return prepareUserMenuFixture(dir);
}
