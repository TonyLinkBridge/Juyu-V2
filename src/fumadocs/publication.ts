import type {Root} from 'fumadocs-core/page-tree';
import {decodeEditorBody,inlineText,type EditorBlock} from '../editor/document.ts';
import type {NavigationNode} from '../reader/tree.ts';
import {articleContentPath} from '../reader/content-path.ts';

export interface FumadocsTocItem {title:string;url:string;depth:number}

const previewRoot='/design-preview/fumadocs-reader';
export type FumadocsReaderMode='preview'|'formal';
export type FumadocsPublicationLocale='zh-CN'|'en';
export type FumadocsLanguageDestinations=Partial<Record<FumadocsPublicationLocale,string>>;

/**
 * Fumadocs identifies the active page from pathname, so every publication must
 * have a unique path. Locale is publication data and must not be encoded only
 * in a query string that the native navigation cannot see.
 */
export function canonicalFumadocsPublicationPath(id:string):string {
 return `${previewRoot}/${encodeURIComponent(id)}`;
}

export function formalFumadocsPublicationPath(id:string):string {
 return articleContentPath(id);
}

function publicationPath(id:string,mode:FumadocsReaderMode):string {
 return mode==='formal'?formalFumadocsPublicationPath(id):canonicalFumadocsPublicationPath(id);
}

export function fumadocsMarkdownPath(id:string,revision:number):string {
 return `/api/articles/${encodeURIComponent(id)}/markdown?revision=${revision}`;
}

export function fumadocsPdfPath(article:{id:string;revision:number;locale?:FumadocsPublicationLocale}):string {
 return `/help-centre/pdf?article=${encodeURIComponent(article.id)}&revision=${article.revision}${article.locale==='en'?'&lang=en':''}`;
}

/** Only offer a locale when an authorized published document ID exists. */
export function fumadocsPublicationLanguages(article:{id:string;locale?:FumadocsPublicationLocale;sourceId?:string;englishId?:string|null},mode:FumadocsReaderMode='preview'):FumadocsLanguageDestinations {
 const locale=article.locale==='en'?'en':'zh-CN';
 const result:FumadocsLanguageDestinations={};
 const sourceId=article.sourceId?.trim()||(locale==='zh-CN'?article.id:'');
 const englishId=article.englishId?.trim()||(locale==='en'?article.id:'');
 if(sourceId)result['zh-CN']=publicationPath(sourceId,mode);
 if(englishId)result.en=publicationPath(englishId,mode);
 return result;
}

export function fumadocsPublication(article:{body:string}):{blocks:EditorBlock[];toc:FumadocsTocItem[]} {
 const blocks=decodeEditorBody(article.body);
 if(blocks===null)throw new Error('BLOCKNOTE_BODY_REQUIRED');
 const toc:FumadocsTocItem[]=[];
 const visit=(nodes:EditorBlock[])=>{for(const block of nodes){
  if(block.type==='heading')toc.push({title:inlineText(block.content),url:`#${block.id}`,depth:Math.min(6,(block.props.level??1)+1)});
  visit(block.children);
 }};
 visit(blocks);
 return {blocks,toc};
}

export function fumadocsPublicationTree(nodes:NavigationNode[],locale:FumadocsPublicationLocale,mode:FumadocsReaderMode='preview'):Root {
 const convert=(items:NavigationNode[]):Root['children']=>items.map(node=>node.type==='group'?{
  type:'folder' as const,
  $id:node.id,
  name:node.title,
  children:convert(node.descendants),
 }:{
  type:'page' as const,
  $id:node.id,
  name:node.title,
  url:publicationPath(node.id,mode),
 });
 const name=locale==='en'?'Knowledge Base':'资料目录';
 return {name,children:[{type:'folder',name,root:true,defaultOpen:true,children:convert(nodes)}]};
}
