import type {ContentKind} from '../domain/model.ts';
import type {NavigationNode} from './tree.ts';
export const SEARCH_LIMIT=120;
const PAGE_SIZE=20;
export type SearchQuery={status:'empty'|'invalid'|'ready';query:string};
export interface SearchResult {id:string;title:string;href:string;breadcrumbs:string[];snippet?:string;tags?:string[];kind?:ContentKind;revision?:number}
export interface TitleSearch extends SearchQuery {results:SearchResult[];total:number;page:number;pages:number}
// ASCII case folding preserves UTF-16 offsets for highlighting; Chinese stays literal.
export const foldSearchText=(text:string)=>text.replace(/[A-Z]/g,letter=>letter.toLowerCase());
export function parseSearchQuery(value:string|string[]|undefined):SearchQuery {
 if(value===undefined)return {status:'empty',query:''};
 if(typeof value!=='string'||value.length>SEARCH_LIMIT||/[\u0000-\u001f\u007f]/.test(value))return {status:'invalid',query:''};
 const query=value.trim().replace(/\s+/g,' ');
 return {status:query?'ready':'empty',query};
}
export function searchHref(query:string,page=1):string {
 const params=new URLSearchParams({q:query});if(page>1)params.set('page',String(page));
 return `/help-centre?${params}`;
}
/** Called only on a server-authorized publication tree. Not an authorization boundary. */
export function searchTitles(nodes:NavigationNode[],raw:string|string[]|undefined,rawPage?:string|string[]):TitleSearch {
 const parsed=parseSearchQuery(raw);
 const validPage=rawPage===undefined||(typeof rawPage==='string'&&/^[1-9][0-9]{0,5}$/.test(rawPage));
 const page=validPage?Number(rawPage??1):1;
 const state:TitleSearch={...parsed,status:validPage?parsed.status:'invalid',results:[],total:0,page,pages:0};
 if(state.status!=='ready')return state;
 const words=foldSearchText(parsed.query).split(' ');
 const stack=nodes.map(node=>({node,breadcrumbs:[] as string[]})).reverse();
 const seen=new Set<string>();const matches:SearchResult[]=[];
 while(stack.length){
   const {node,breadcrumbs}=stack.pop()!;
   if(node.type==='group'){
     for(let i=node.descendants.length-1;i>=0;i--)stack.push({node:node.descendants[i],breadcrumbs:[...breadcrumbs,node.title]});
   }else if(!seen.has(node.id)){
     seen.add(node.id);
     if(words.every(word=>foldSearchText(node.title).includes(word)))matches.push({id:node.id,title:node.title,href:node.href,breadcrumbs});
   }
 }
 return {...state,total:matches.length,pages:Math.ceil(matches.length/PAGE_SIZE),results:matches.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)};
}

/** Plain text excerpt only. Call after authorization; React escapes it when displayed. */
export function searchSnippet(text:string,query:string):string {
 const plain=text.replace(/\s+/g,' ').trim();
 if(plain.length<=240)return plain;
 const folded=foldSearchText(plain);
 const positions=foldSearchText(query).split(/\s+/).filter(Boolean).map(word=>folded.indexOf(word)).filter(index=>index>=0);
 const match=positions.length?Math.min(...positions):0;
 let start=Math.max(0,match-60);
 // UTF-16 offsets agree with the existing highlighter, but must not bisect emoji.
 if(start>0&&/[\uDC00-\uDFFF]/.test(plain[start]))start--;
 let end=Math.min(plain.length,start+240);
 if(end<plain.length&&/[\uDC00-\uDFFF]/.test(plain[end]))end--;
 return (start?'…':'')+plain.slice(start,end)+(end<plain.length?'…':'');
}

/** Called after server authorization; Q&A opens its independent answer page directly. */
export function searchResultHref(kind:ContentKind,id:string,articleHref:string):string {
 return kind==='qa'?`/help-centre/qa?question=${encodeURIComponent(id)}#qa-${encodeURIComponent(id)}`:articleHref;
}
