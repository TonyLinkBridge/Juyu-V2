'use client';
import {useState} from 'react';
import {externalEmbedSource,externalLinkSource} from '../../../media/external-embed';
import type {MediaBlock} from '../../../media/model';
import {useReaderLocale} from '../../reader-support/ArticleReferenceContext';

export function ExternalEmbed({block}:{block:Extract<MediaBlock,{type:'externalEmbed'}>}){
 const english=useReaderLocale()==='en';
 const [loaded,setLoaded]=useState(false),source=externalEmbedSource(block.url),link=externalLinkSource(block.url);
 if(!link)return <p role="alert">{english?'This external link is invalid.':'外部内容地址无效。'}</p>;
 if(!source)return <figure className="reader-external-embed"><div className="reader-embed-gate"><strong>{english?'External link':'外部链接'} · {link.host}</strong><p>{english?'This site cannot be previewed here. The link opens in a new tab.':'这个网站不支持站内预览。点击链接后会在新页面打开。'}</p><a href={link.original} target="_blank" rel="noopener noreferrer">{english?'Open website':'打开外部网站'}</a></div>{block.caption&&<figcaption>{block.caption}</figcaption>}</figure>;
 return <figure className="reader-external-embed">
  {loaded?<iframe title={block.caption||(english?`${source.provider} content`:`${source.provider} 外部内容`)} src={source.frame} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="fullscreen; picture-in-picture" allowFullScreen/>:<div className="reader-embed-gate"><strong>{english?`${source.provider} content`:`${source.provider} 内容`}</strong><p>{english?'This content is hosted elsewhere. Your browser will connect to that site only when you choose to load it.':'此内容由外部网站提供。点击后浏览器才会连接该网站。'}</p><button type="button" onClick={()=>setLoaded(true)}>{english?'Load external content':'加载外部内容'}</button></div>}
  <figcaption>{block.caption&&<span>{block.caption} · </span>}<a href={source.original} target="_blank" rel="noopener noreferrer">{english?`Open on ${source.provider}`:`到 ${source.provider} 打开`}</a></figcaption>
 </figure>;
}
