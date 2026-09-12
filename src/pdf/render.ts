import {fieldValueText} from '../fields/editor.ts';
import {printEditor} from '../editor/print.ts';
import {mathMarkup} from '../science/model.ts';
import {inlineHTML} from '../reader/inline.ts';
import {normalizeBlocks,hintLabels,type MediaBlock} from '../media/model.ts';
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
.pdf-hint{border:1px solid #999;border-left:4px solid #777;padding:4mm;margin:5mm 0}.pdf-code{border:1px solid #bbb;padding:4mm;margin:5mm 0}.pdf-code pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:9pt;font-family:monospace;tab-size:4}.pdf-tabs{border-left:2px solid #aaa;padding-left:4mm;margin:5mm 0}
@media print{body{margin:0;background:white}.pdf-controls,.reader-chrome,.site-header,.site-footer,.skip-link,.knowledge-sidebar,.feature-announcements,.reader-announcement{display:none!important}.entry-frame,.knowledge-body,.knowledge-content{display:block!important;min-height:0!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important}.pdf-paper{padding:0;max-width:none;box-shadow:none} .pdf-shell{padding:0!important;margin:0!important}}
@media screen and (max-width:600px){.pdf-paper{padding:24px 18px}}
`;
export function pdfContent(article:Publication,coverSource?:string,images?:Record<string,string>):string {
 if(coverSource&&!/^\/api\/assets\/[0-9a-f-]{36}$/i.test(coverSource)&&!/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(coverSource))throw new Error('INVALID_IMAGE');
 const e=escapeHTML;const document=parseReaderBody(article.body);const legacy=document.blocks.map(b=>{
  if(b.type==='heading')return `<h${b.depth+1}>${inlineHTML(b.text)}</h${b.depth+1}>`;
  if(b.type==='paragraph')return `<p>${inlineHTML(b.text)}</p>`;
  if(b.type==='list'){const tag=b.ordered?'ol':'ul';return `<${tag}${b.ordered?` start="${b.start}"`:''}>${b.items.map(t=>`<li>${inlineHTML(t)}</li>`).join('')}</${tag}>`;}
  return `<table><thead><tr>${b.headers.map(t=>`<th scope="col">${e(t)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row=>`<tr>${row.map(t=>`<td>${e(t)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 }).join('');
 const renderMedia=(b:MediaBlock):string=>{
  if(b.type==='math'){try{return `<figure>${mathMarkup(b.source)}<figcaption>${e(b.caption)}</figcaption></figure>`;}catch{return `<p>公式错误：${e(b.source)}</p>`;}}
  if(b.type==='diagram'){const src=images?.['diagram:'+b.id]??`/api/articles/${encodeURIComponent(article.id)}/diagram?revision=${article.revision}&block=${encodeURIComponent(b.id)}`;return `<figure><img style="max-height:180mm" src="${e(src)}" alt="${e(b.caption||'流程图')}"><figcaption>${e(b.caption)}</figcaption></figure>`;}
  if(b.type==='hint')return `<aside class="pdf-hint"><strong>${e(hintLabels[b.style])}${b.title?` · ${e(b.title)}`:''}</strong><p>${e(b.body)}</p></aside>`;
  if(b.type==='code')return `<section class="pdf-code"><p>${e(b.language||'纯文本')}</p><pre><code>${e(b.code)}</code></pre></section>`;
  if(b.type==='tabs')return `<section class="pdf-tabs">${b.tabs.map((t,i)=>`<h3>${e(t.title||`标签 ${i+1}`)}</h3><p>${e(t.body)}</p>`).join('')}</section>`;
  if(b.type==='table')return `<table><thead><tr>${b.headers.map(t=>`<th scope="col">${e(t)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.map(t=>`<td>${e(t)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  if(b.type==='image'){const src=images?images[b.assetId]:`/api/assets/${b.assetId}`;if(!src||!/^\/api\/assets\/[0-9a-f-]{36}$|^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src))throw new Error('INVALID_IMAGE');return `<figure style="margin:6mm 0;break-inside:avoid"><img src="${e(src)}" alt="${e(b.alt)}" style="max-height:180mm;object-fit:contain"><figcaption>${e(b.caption)}</figcaption></figure>`;}
  return `<p>${b.type==='video'?'影片':b.type==='audio'?'音频':'文件'}：${e(b.caption||b.alt||'附件')}（请返回资料库打开，PDF 不包含可播放影片或附件字节。）</p>`;
 };
 const fields=article.customFields?.length?`<section><h2>自定义资料</h2><table><tbody>${article.customFields.map(f=>`<tr><th scope="row">${e(f.name)}</th><td>${e(fieldValueText(f.value))}</td></tr>`).join('')}</tbody></table></section>`:'';
 const blocks=document.editorBlocks?printEditor(document.editorBlocks,renderMedia):legacy;
 const media=document.editorBlocks?'':normalizeBlocks(article.blocks).map(renderMedia).join('');
 return `${coverSource?`<img class="pdf-cover" src="${e(coverSource)}" alt="${e(article.cover?.alt??'')}" style="object-position:center ${article.cover?.position??50}%">`:''}<h1>${e(article.title)}</h1><p class="pdf-meta">JUYU 内部资料库 · 正式版本 ${article.revision}${article.tags?.length?` · ${article.tags.map(e).join(' / ')}`:''}</p>${fields}${blocks||(!media?'<p>这篇文章暂时没有正文。</p>':'')}${media}`;
}
export function pdfHTML(article:Publication,coverSource?:string,images?:Record<string,string>):string{return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHTML(article.title)}</title><style>${pdfCSS}</style></head><body><article class="pdf-paper">${pdfContent(article,coverSource,images)}</article></body></html>`;}
