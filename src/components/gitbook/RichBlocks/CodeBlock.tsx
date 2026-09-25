'use client';
import {useEffect,useState} from 'react';
import {codeHighlighter} from '../../../editor/highlight';
import {codeLineNumbers} from '../../../media/code-lines';
import type {TextBlock} from '../../../media/model';
import {CopyCodeButton} from './CopyCodeButton';
import {useReaderLocale} from '../../reader-support/ArticleReferenceContext';
export function CodeBlock({block}:{block:Extract<TextBlock,{type:'code'}>}){
 const english=useReaderLocale()==='en';
 const [highlight,setHighlight]=useState<{code:string;language:string;html:string}|null>(null);
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{let active=true;const lang=block.language||'text';if(['text','none','plaintext','txt'].includes(lang))return;
  const emphasized=codeLineNumbers(block.highlightLines),added=codeLineNumbers(block.addedLines),removed=codeLineNumbers(block.removedLines);
  void codeHighlighter().then(async highlighter=>{await highlighter.loadLanguage(lang as Parameters<typeof highlighter.loadLanguage>[0]);const html=highlighter.codeToHtml(block.code,{lang,themes:{light:'github-light',dark:'github-dark'},defaultColor:false,transformers:[{line(node,line){const kind=removed.has(line)?'removed':added.has(line)?'added':emphasized.has(line)?'highlighted':'';if(kind)node.properties.className=[...(Array.isArray(node.properties.className)?node.properties.className:[]),`rich-code-${kind}`];}}]});if(active)setHighlight({code:block.code,language:block.language,html});}).catch(()=>{});
  return()=>{active=false;};
 },[block.code,block.language,block.highlightLines,block.addedLines,block.removedLines]);
 const html=highlight?.code===block.code&&highlight.language===block.language?highlight.html:null;
 const lines=block.code.split('\n'),limit=block.collapsedLines??10,canCollapse=Boolean(block.expandable&&lines.length>limit);
 const emphasized=codeLineNumbers(block.highlightLines),added=codeLineNumbers(block.addedLines),removed=codeLineNumbers(block.removedLines);
 const lineClass=(line:number)=>`rich-code-line${removed.has(line)?' rich-code-removed':added.has(line)?' rich-code-added':emphasized.has(line)?' rich-code-highlighted':''}`;
 const collapsed=canCollapse&&!expanded;
 return <section className={`rich-code${block.lineNumbers?' has-line-numbers':''}${block.wrap?' has-wrap':''}${collapsed?' is-collapsed':''}`} aria-label={english?'Code block':'代码框'}><div className="rich-code-header"><span>{block.title||block.language||(english?'Plain text':'纯文本')}{block.title&&block.language&&<small> · {block.language}</small>}</span><CopyCodeButton key={block.code} code={block.code}/></div><div className="rich-code-body" style={collapsed?{maxHeight:`${limit*1.8*13+40}px`}:undefined}>{html?<div className="native-highlight" role="region" tabIndex={0} aria-label={english?'Code; scroll horizontally to view long lines':'代码内容，可横向滚动'} dangerouslySetInnerHTML={{__html:html}}/>:<pre role="region" tabIndex={0} aria-label={english?'Code; scroll horizontally to view long lines':'代码内容，可横向滚动'}><code>{lines.map((line,index)=><span className={lineClass(index+1)} key={index}>{line||' '}</span>)}</code></pre>}</div>{canCollapse&&<button type="button" className="rich-code-expand" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{english?(expanded?'Show less':`Show all ${lines.length} lines`):(expanded?'收起代码':`展开全部 ${lines.length} 行`)}</button>}</section>;
}
