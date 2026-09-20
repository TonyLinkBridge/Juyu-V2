'use client';
import {useMemo,useRef,useState} from 'react';
import type {Publication} from '../../../reader/body';
import {publicationMarkdown} from '../../../reader/markdown';

export function ArticleMarkdownActions({article}:{article:Publication}){
 const dialog=useRef<HTMLDialogElement>(null),area=useRef<HTMLTextAreaElement>(null),[status,setStatus]=useState('');
 const markdown=useMemo(()=>publicationMarkdown(article),[article]);
 const english=article.locale==='en';
 async function copy(){try{await navigator.clipboard.writeText(markdown);setStatus(english?'Markdown copied.':'Markdown 已复制。');}catch{setStatus(english?'Copying failed. Open the Markdown and copy it manually.':'复制未成功。请打开 Markdown 后手动选择复制。');dialog.current?.showModal();area.current?.focus();area.current?.select();}}
 return <div className="reader-markdown-actions"><button type="button" className="secondary-link" onClick={()=>{setStatus('');dialog.current?.showModal();}}>{english?'View Markdown':'查看 Markdown'}</button><button type="button" className="secondary-link" onClick={()=>void copy()}>{english?'Copy Markdown':'复制 Markdown'}</button>{status&&<p role="status">{status}</p>}<dialog ref={dialog} className="reader-markdown-dialog" aria-label={english?'Article Markdown':'文章 Markdown'} onClose={()=>setStatus('')}><header><h2>{english?'Article Markdown':'文章 Markdown'}</h2><button type="button" aria-label={english?'Close Markdown':'关闭 Markdown'} onClick={()=>dialog.current?.close()}>×</button></header><p>{english?'This copy-friendly format does not preserve every colour or interactive block. Images and attachments still require Help Centre access.':'这是便于复制的文本格式；颜色、分页标签等交互不会完整保留。图片和附件链接仍需资料库权限。'}</p><textarea ref={area} readOnly aria-label={english?'Article Markdown text':'文章 Markdown 内容'} value={markdown} rows={18}/><div><button type="button" onClick={()=>void copy()}>{english?'Copy all':'复制全文'}</button><button type="button" onClick={()=>dialog.current?.close()}>{english?'Close':'关闭'}</button></div></dialog></div>;
}
