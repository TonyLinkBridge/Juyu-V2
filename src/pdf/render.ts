import {fieldValueText} from '../fields/editor.ts';
import {printEditor} from '../editor/print.ts';
import {mathMarkup} from '../science/model.ts';
import {externalEmbedSource,externalLinkSource} from '../media/external-embed.ts';
import {inlineHTML} from '../reader/inline.ts';
import {normalizeBlocks,hintLabels,type MediaBlock} from '../media/model.ts';
import {decodeTabBody} from '../media/tab-body.ts';
import {codeLineNumbers} from '../media/code-lines.ts';
import {parseReaderBody,type Publication} from '../reader/body.ts';
export function escapeHTML(value:string):string{return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
// Print layout adapted from GitBook PDFPage.tsx and pdf.css: white A4 sheet,
// heading break protection and isolated print-only content; no vendor links.
export const pdfCSS=`
@page{size:A4;margin:18mm 16mm 20mm}
.pdf-paper{color:#222;background:#fff;font-family:Arial,"PingFang SC","Microsoft YaHei","Noto Sans SC","Noto Sans CJK SC",sans-serif;font-size:11pt;line-height:1.7;overflow-wrap:anywhere;max-width:210mm;margin:auto;padding:18mm 16mm;box-sizing:border-box;min-width:0}
.pdf-paper h1{font-size:24pt;line-height:1.3;margin:0 0 8mm}.pdf-paper h2{font-size:17pt}.pdf-paper h3{font-size:14pt}.pdf-paper h4{font-size:12pt}
.pdf-paper h1,.pdf-paper h2,.pdf-paper h3,.pdf-paper h4{break-inside:avoid;break-after:avoid}.pdf-paper p{white-space:pre-wrap;orphans:3;widows:3;margin:4mm 0}
.pdf-meta{color:#555;font-size:9pt;border-bottom:1px solid #ccc;padding-bottom:5mm}.pdf-cover{width:100%;height:48mm;object-fit:cover;break-inside:avoid;margin-bottom:6mm}
.pdf-paper ul{list-style:disc;padding-left:6mm}.pdf-paper ol{list-style:decimal;padding-left:6mm}
.pdf-paper table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin:5mm 0}.pdf-paper th,.pdf-paper td{border:1px solid #999;padding:2mm;white-space:pre-wrap;vertical-align:top;overflow-wrap:anywhere}.pdf-paper th{background:#eee}.pdf-paper thead{display:table-header-group}.pdf-paper tr{break-inside:avoid}.pdf-paper li{white-space:pre-wrap}.pdf-paper img{max-width:100%}
.pdf-hint{border:1px solid #999;border-left:4px solid #777;padding:4mm;margin:5mm 0;min-width:0}.pdf-hint-nested{min-width:0}.pdf-hint-nested table,.pdf-hint-nested pre{max-width:100%;overflow-wrap:anywhere}.pdf-code{border:1px solid #bbb;padding:4mm;margin:5mm 0}.pdf-code pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:9pt;font-family:monospace;tab-size:4}.pdf-code-line{display:block;min-height:1.7em}.pdf-code-highlighted{background:#e9efff}.pdf-code-added{background:#e2f4e9}.pdf-code-removed{background:#fbe8e8}.pdf-tabs{border-left:2px solid #aaa;padding-left:4mm;margin:5mm 0}
.pdf-steps{counter-reset:step;list-style:none!important;padding-left:0!important}.pdf-steps>li{counter-increment:step;border-left:1px solid #ccd6e8;margin-left:4mm;padding:0 0 5mm 7mm;break-inside:avoid}.pdf-steps>li::before{content:counter(step);display:inline-block;background:#2f61be;color:white;border-radius:50%;font-size:9pt;text-align:center;width:7mm;height:7mm;line-height:7mm;margin-left:-11mm;margin-right:4mm}.pdf-steps h3{display:inline;font-size:12pt}
.pdf-columns{display:flex;gap:5mm;align-items:flex-start;margin:5mm 0}.pdf-columns>section{flex:1;min-width:0;break-inside:avoid;border:1px solid #ddd;padding:3mm}.pdf-columns h3{font-size:11pt;margin:0 0 2mm}
.pdf-inline-image{display:inline-block;max-height:9mm;max-width:35mm;vertical-align:middle;object-fit:contain}.pdf-inline-icon{font-size:.8em;color:#c5222e}.pdf-inline-math{display:inline-block;vertical-align:middle}
@media print{body{margin:0;background:white}.pdf-controls,.reader-chrome,.site-header,.site-footer,.skip-link,.knowledge-sidebar,.feature-announcements,.reader-announcement{display:none!important}.entry-frame,.knowledge-body,.knowledge-content{display:block!important;min-height:0!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important}.pdf-paper{padding:0;max-width:none;box-shadow:none} .pdf-shell{padding:0!important;margin:0!important}}
@media screen and (max-width:600px){.pdf-paper{padding:24px 18px}}
`;
export function pdfContent(article:Publication,coverSource?:string,images?:Record<string,string>):string {
 if(coverSource&&!/^\/api\/assets\/[0-9a-f-]{36}$/i.test(coverSource)&&!/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(coverSource))throw new Error('INVALID_IMAGE');
 const e=escapeHTML,en=article.locale==='en',label=(zh:string,english:string)=>en?english:zh;const document=parseReaderBody(article.body);const legacy=document.blocks.map(b=>{
  if(b.type==='heading')return `<h${b.depth+1}>${inlineHTML(b.text)}</h${b.depth+1}>`;
  if(b.type==='paragraph')return `<p>${inlineHTML(b.text)}</p>`;
  if(b.type==='list'){const tag=b.ordered?'ol':'ul';return `<${tag}${b.ordered?` start="${b.start}"`:''}>${b.items.map(t=>`<li>${inlineHTML(t)}</li>`).join('')}</${tag}>`;}
  return `<table><thead><tr>${b.headers.map(t=>`<th scope="col">${e(t)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row=>`<tr>${row.map(t=>`<td>${e(t)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 }).join('');
 const inlineImageSource=(assetId:string)=>{const source=images?.[assetId]??`/api/assets/${assetId}`;if(!/^\/api\/assets\/[0-9a-f-]{36}$|^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(source))throw new Error('INVALID_IMAGE');return source;};
 const renderMedia=(b:MediaBlock,children=''):string=>{
  if(b.type==='math'){try{return `<figure>${mathMarkup(b.source)}<figcaption>${e(b.caption)}</figcaption></figure>`;}catch{return `<p>${label('公式错误','Invalid formula')}: ${e(b.source)}</p>`;}}
  if(b.type==='diagram'){const src=images?.['diagram:'+b.id]??`/api/articles/${encodeURIComponent(article.id)}/diagram?revision=${article.revision}&block=${encodeURIComponent(b.id)}`;return `<figure><img style="max-height:180mm" src="${e(src)}" alt="${e(b.caption||label('流程图','Flowchart'))}"><figcaption>${e(b.caption)}</figcaption></figure>`;}
  if(b.type==='hint')return `<aside class="pdf-hint" role="note" aria-label="${e(hintLabels[b.style])}">${b.showTitle===false?'':`<strong>${e(b.title||hintLabels[b.style])}</strong>`}${b.body?`<p>${e(b.body)}</p>`:''}${children?`<div class="pdf-hint-nested">${children}</div>`:''}</aside>`;
  if(b.type==='code'){
   const highlighted=codeLineNumbers(b.highlightLines),added=codeLineNumbers(b.addedLines),removed=codeLineNumbers(b.removedLines);
   const lines=b.code.split('\n').map((line,index)=>{const number=index+1,kind=removed.has(number)?' pdf-code-removed':added.has(number)?' pdf-code-added':highlighted.has(number)?' pdf-code-highlighted':'';return `<span class="pdf-code-line${kind}">${b.lineNumbers?`${String(number).padStart(3,' ')}  `:''}${e(line)||' '}</span>`;}).join('');
   return `<section class="pdf-code"><p>${e(b.title||b.language||label('纯文本','Plain text'))}${b.title&&b.language?` · ${e(b.language)}`:''}</p><pre style="white-space:${b.wrap?'pre-wrap':'pre'}">${lines}</pre></section>`;
  }
  if(b.type==='tabs')return `<section class="pdf-tabs">${b.tabs.map((t,i)=>`<h3>${e(t.title||`${label('标签','Tab')} ${i+1}`)}</h3>${decodeTabBody(t.body)?printEditor(decodeTabBody(t.body)!,renderMedia,inlineImageSource):`<p>${e(t.body)}</p>`}`).join('')}</section>`;
  if(b.type==='steps')return `<ol class="pdf-steps">${b.steps.map((step,i)=>`<li><h3>${e(step.title||`${label('步骤','Step')} ${i+1}`)}</h3>${decodeTabBody(step.body)?printEditor(decodeTabBody(step.body)!,renderMedia,inlineImageSource):step.body?`<p>${e(step.body)}</p>`:''}</li>`).join('')}</ol>`;
  if(b.type==='columns')return `<div class="pdf-columns">${b.columns.map((column,i)=>`<section><h3>${e(column.title||`${label('第','Column')} ${i+1}${en?'':' 栏'}`)}</h3>${decodeTabBody(column.body)?printEditor(decodeTabBody(column.body)!,renderMedia,inlineImageSource):column.body?`<p>${e(column.body)}</p>`:''}</section>`).join('')}</div>`;
  if(b.type==='table')return `<table><thead><tr>${b.headers.map(t=>`<th scope="col">${e(t)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.map(t=>`<td>${e(t)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  if(b.type==='image'){const src=images?images[b.assetId]:`/api/assets/${b.assetId}`;if(!src||!/^\/api\/assets\/[0-9a-f-]{36}$|^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src))throw new Error('INVALID_IMAGE');return `<figure style="margin:6mm 0;break-inside:avoid"><img src="${e(src)}" alt="${e(b.alt)}" style="max-height:180mm;object-fit:contain"><figcaption>${e(b.caption)}</figcaption></figure>`;}
  if(b.type==='articleReference')return `<aside class="pdf-hint">${label('这处引用请在资料库内按当前权限查看。','Open this reference in the Help Centre with your current access.')}</aside>`;
  if(b.type==='button')return `<p><a href="${e(b.href)}">${e(b.label)}</a></p>`;
  if(b.type==='externalEmbed'){const source=externalEmbedSource(b.url),link=externalLinkSource(b.url);return link?`<p>${label('外部内容','External content')}${b.caption?` · ${e(b.caption)}`:''}：<a href="${e(link.original)}">${source?`${label('到','Open in')} ${e(source.provider)}${en?'':' 打开'}`:label('打开外部网站','Open website')}</a></p>`:`<p>${label('外部内容地址无效。','This external link is invalid.')}</p>`;}
  return `<p>${b.type==='video'?label('影片','Video'):b.type==='audio'?label('音频','Audio'):label('文件','File')}：${e(b.caption||b.alt||label('附件','Attachment'))}${label('（请返回资料库打开，PDF 不包含可播放影片或附件字节。）',' (Open this in the Help Centre. Playable media and attachment files are not included in this PDF.)')}</p>`;
 };
 const fields=article.customFields?.length?`<section><h2>${label('自定义资料','Additional details')}</h2><table><tbody>${article.customFields.map(f=>`<tr><th scope="row">${e(f.name)}</th><td>${e(fieldValueText(f.value))}</td></tr>`).join('')}</tbody></table></section>`:'';
 const blocks=document.editorBlocks?printEditor(document.editorBlocks,renderMedia,inlineImageSource):legacy;
 const media=document.editorBlocks?'':normalizeBlocks(article.blocks).map(b=>renderMedia(b)).join('');
 return `${coverSource?`<img class="pdf-cover" src="${e(coverSource)}" alt="${e(article.cover?.alt??'')}" style="object-position:center ${article.cover?.position??50}%">`:''}<h1>${e(article.title)}</h1>${article.description?`<p class="pdf-description">${e(article.description)}</p>`:''}<p class="pdf-meta">${label('JUYU 内部资料库','JUYU Help Centre')} · ${article.publicationNumber?`${label('正式版本','Published version')} ${article.publicationNumber}`:label('已发布','Published')}${article.publishedAt?` · ${label('发布于','Published')} ${e(new Intl.DateTimeFormat(en?'en-MY':'zh-CN',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'long',day:'numeric'}).format(new Date(article.publishedAt)))}`:''}${article.tags?.length?` · ${article.tags.map(e).join(' / ')}`:''}</p>${fields}${blocks||(!media?`<p>${label('这篇文章暂时没有正文。','This article has no body content yet.')}</p>`:'')}${media}`;
}
export function pdfHTML(article:Publication,coverSource?:string,images?:Record<string,string>):string{return `<!doctype html><html lang="${article.locale==='en'?'en':'zh-CN'}"><head><meta charset="utf-8"><title>${escapeHTML(article.title)}</title><style>${pdfCSS}</style></head><body><article class="pdf-paper">${pdfContent(article,coverSource,images)}</article></body></html>`;}
