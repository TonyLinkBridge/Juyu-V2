'use client';

import {DynamicCodeBlock} from 'fumadocs-ui/components/dynamic-codeblock';
import {useState} from 'react';
import {codeLineNumbers} from '../../../media/code-lines';
import type {TextBlock} from '../../../media/model';
import {useReaderLocale} from '../../reader-support/ArticleReferenceContext';

export function CodeBlock({block}:{block:Extract<TextBlock,{type:'code'}>}){
 const english=useReaderLocale()==='en';
 const [expanded,setExpanded]=useState(false);
 const language=block.language.trim()||'text';
 const title=block.title?`${block.title}${block.language?` · ${block.language}`:''}`:language;
 const lines=block.code.split('\n');
 const collapsedLines=block.collapsedLines??10;
 const canCollapse=Boolean(block.expandable&&lines.length>collapsedLines);
 const isExpanded=!canCollapse||expanded;
 const highlighted=codeLineNumbers(block.highlightLines);
 const added=codeLineNumbers(block.addedLines);
 const removed=codeLineNumbers(block.removedLines);

 return <section className="fumadocs-reader-code" data-fumadocs-code={block.id} data-expanded={String(isExpanded)} aria-label={english?'Code block':'代码框'}>
  <DynamicCodeBlock
   lang={language}
   code={block.code}
   codeblock={{
    title,
    className:block.wrap?'fumadocs-code-wrap':undefined,
    'data-line-numbers':block.lineNumbers||undefined,
    viewportProps:{
     'aria-label':english?'Code; scroll horizontally to view long lines':'代码内容，可横向滚动',
     className:`fumadocs-code-viewport ${isExpanded?'is-expanded':'is-collapsed'}`,
     style:{'--juyu-code-visible-lines':collapsedLines} as React.CSSProperties,
    },
   }}
   options={{themes:{light:'github-light',dark:'github-dark'},transformers:[{name:'juyu-fumadocs-code-lines',line(node,line){
    const names=removed.has(line)?['diff','remove']:added.has(line)?['diff','add']:highlighted.has(line)?['highlighted']:[];
    for(const name of names)this.addClassToHast(node,name);
   }}]}}
  />
  {canCollapse&&<button type="button" className="rich-code-expand" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{english?(expanded?'Show less':`Show all ${lines.length} lines`):(expanded?'收起代码':`展开全部 ${lines.length} 行`)}</button>}
 </section>;
}
