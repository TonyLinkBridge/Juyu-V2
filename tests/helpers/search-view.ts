import {createRequire} from 'node:module';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import ts from 'typescript';
const require=createRequire(import.meta.url);
export async function loadSearchViews(){
 const directory=resolve('output/verification/search-view');await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'package.json'),'{"type":"commonjs"}');
 const files=['reader/content-path.ts','reader/search.ts',...['SearchResults','SearchPageResultItem','SearchResultItem','HighlightQuery'].map(n=>`components/gitbook/Search/${n}.tsx`)];
 for(const file of files){const destination=resolve(directory,file==='reader/content-path.ts'?file:file.replace(/\.tsx?$/,'.js'));await mkdir(dirname(destination),{recursive:true});await writeFile(destination,ts.transpileModule(await readFile(`src/${file}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);}
 return {SearchResults:require(resolve(directory,'components/gitbook/Search/SearchResults.js')).SearchResults as typeof import('../../src/components/gitbook/Search/SearchResults').SearchResults};
}
