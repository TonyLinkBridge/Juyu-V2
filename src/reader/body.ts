import type {SavedFeedback} from '../feedback/model.ts';
import type {FieldSnapshot} from '../fields/model.ts';
import {decodeEditorBody,inlineText,type EditorBlock} from '../editor/document.ts';
import {inlineTokens} from './inline.ts';
import type {ArticlePresentation} from '../domain/presentation.ts';
export interface Publication extends ArticlePresentation {locale?:'zh-CN'|'en';sourceId?:string;englishId?:string|null;publicationNumber?:number|null;publishedAt?:string;feedback?:{memberId:string;value:SavedFeedback|null};customFields?:FieldSnapshot[];id:string;title:string;revision:number;body:string}
export interface DocumentSection {id:string;title:string;depth:1|2|3|4|5|6}
export type ReaderBlock={type:'table';headers:string[];rows:string[][]}|{type:'heading';id:string;text:string;depth:1|2|3}|{type:'paragraph';text:string}|{type:'list';ordered:boolean;start:number;items:string[]};
export interface ReaderDocument {blocks:ReaderBlock[];sections:DocumentSection[];editorBlocks?:EditorBlock[]}

/** Temporary text snapshot adapter; never interprets HTML, URLs or remote media.
 * Supports a bounded pipe-table subset for shared reader/PDF output. Richer blocks remain separate tasks. */
export function parseReaderBody(body:string):ReaderDocument {
 const editorBlocks=decodeEditorBody(body);
 if(editorBlocks!==null){const sections:DocumentSection[]=[];const visit=(nodes:EditorBlock[])=>{for(const block of nodes){if(block.type==='heading')sections.push({id:block.id,title:inlineText(block.content),depth:block.props.level??1});visit(block.children);}};visit(editorBlocks);return {blocks:[],sections,editorBlocks};}
 const blocks:ReaderBlock[]=[];const sections:DocumentSection[]=[];
 let paragraph:string[]=[];
 const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[];}};
 const lines=body.replace(/\r\n?/g,'\n').split('\n');
 for(let index=0;index<lines.length;index++) {
   const line=lines[index];
   const fence=line.match(/^ {0,3}(`{3,}|~{3,})/);
   if(fence){
     flush();const literal=[line];const marker=fence[1];
     while(++index<lines.length){const next=lines[index];literal.push(next);const close=next.trim();if(close.length>=marker.length&&[...close].every(char=>char===marker[0]))break;}
     blocks.push({type:'paragraph',text:literal.join('\n')});continue;
   }
   if(!line.trim()){flush();continue;}
   const cells=(value:string)=>value.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
   const header=cells(line),divider=index+1<lines.length?cells(lines[index+1]):[];
   if(line.trim().startsWith('|')&&line.trim().endsWith('|')&&header.length>1&&header.length===divider.length&&divider.every(x=>/^:?-{3,}:?$/.test(x))){
     flush();index++;const rows:string[][]=[];
     while(index+1<lines.length){const next=lines[index+1].trim();if(!next.startsWith('|')||!next.endsWith('|'))break;const row=cells(next);if(row.length!==header.length)break;rows.push(row);index++;}
     blocks.push({type:'table',headers:header,rows});continue;
   }
   const heading=line.match(/^(#{1,3})[ \t]+(.+?)\s*$/);
   if(heading){flush();const depth=heading[1].length as 1|2|3;const id=`section-${sections.length+1}`;sections.push({id,title:inlineTokens(heading[2]).map(t=>t.text).join(''),depth});blocks.push({type:'heading',id,text:heading[2],depth});continue;}
   const list=line.match(/^[ \t]*(?:([-+*])|([0-9]{1,9})[.)])[ \t]+(.+)$/);
   if(list){
     flush();const ordered=Boolean(list[2]);const items=[list[3]];
     while(index+1<lines.length){const next=lines[index+1].match(/^[ \t]*(?:([-+*])|([0-9]{1,9})[.)])[ \t]+(.+)$/);if(!next||Boolean(next[2])!==ordered)break;items.push(next[3]);index++;}
     blocks.push({type:'list',ordered,start:ordered?Number(list[2]):1,items});continue;
   }
   paragraph.push(line);
 }
 flush();return {blocks,sections};
}
