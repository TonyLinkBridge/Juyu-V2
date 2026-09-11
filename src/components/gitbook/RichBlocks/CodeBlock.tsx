'use client';
import {useEffect,useState} from 'react';
import {codeHighlighter} from '../../../editor/highlight';
import type {TextBlock} from '../../../media/model';
import {CopyCodeButton} from './CopyCodeButton';
export function CodeBlock({block}:{block:Extract<TextBlock,{type:'code'}>}){
 const [highlight,setHighlight]=useState<{code:string;language:string;html:string}|null>(null);
 useEffect(()=>{let active=true;const lang=block.language||'text';if(['text','none','plaintext','txt'].includes(lang))return;
  void codeHighlighter().then(async highlighter=>{await highlighter.loadLanguage(lang as Parameters<typeof highlighter.loadLanguage>[0]);const html=highlighter.codeToHtml(block.code,{lang,themes:{light:'github-light',dark:'github-dark'},defaultColor:false});if(active)setHighlight({code:block.code,language:block.language,html});}).catch(()=>{});
  return()=>{active=false;};
 },[block.code,block.language]);
 const html=highlight?.code===block.code&&highlight.language===block.language?highlight.html:null;
 return <section className="rich-code" aria-label="代码框"><div className="rich-code-header"><span>{block.language||'纯文本'}</span><CopyCodeButton key={block.code} code={block.code}/></div>{html?<div className="native-highlight" role="region" tabIndex={0} aria-label="代码内容，可横向滚动" dangerouslySetInnerHTML={{__html:html}}/>:<pre role="region" tabIndex={0} aria-label="代码内容，可横向滚动"><code>{block.code}</code></pre>}</section>;
}
