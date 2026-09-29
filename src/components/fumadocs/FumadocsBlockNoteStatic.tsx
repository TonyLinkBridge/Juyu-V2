import {printEditor} from '../../editor/print';
import {mathMarkup} from '../../science/model';
import {decodeTabBody} from '../../media/tab-body';
import type {EditorBlock} from '../../editor/document';
import type {MediaBlock} from '../../media/model';

const escapeHTML=(value:string)=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));

function staticMedia(block:MediaBlock,children=''):string{
 const text=(value:string)=>escapeHTML(value);
 if(block.type==='hint')return `<aside role="note"><strong>${text(block.title)}</strong>${block.body?`<p>${text(block.body)}</p>`:''}${children}</aside>`;
 if(block.type==='code')return `<figure><figcaption>${text(block.title||block.language||'Code')}</figcaption><pre><code>${text(block.code)}</code></pre></figure>`;
 if(block.type==='math'){
  try{return `<figure>${mathMarkup(block.source)}${block.caption?`<figcaption>${text(block.caption)}</figcaption>`:''}</figure>`;}catch{return `<p>${text(block.source)}</p>`;}
 }
 if(block.type==='diagram')return `<figure><p>${text(block.source)}</p>${block.caption?`<figcaption>${text(block.caption)}</figcaption>`:''}</figure>`;
 if(block.type==='image')return `<figure><img src="/api/assets/${text(block.assetId)}" alt="${text(block.alt)}" loading="lazy">${block.caption?`<figcaption>${text(block.caption)}</figcaption>`:''}</figure>`;
 if(block.type==='video')return `<figure><video src="/api/assets/${text(block.assetId)}" controls preload="metadata"></video>${block.caption?`<figcaption>${text(block.caption)}</figcaption>`:''}</figure>`;
 if(block.type==='audio')return `<figure><audio src="/api/assets/${text(block.assetId)}" controls preload="metadata"></audio>${block.caption?`<figcaption>${text(block.caption)}</figcaption>`:''}</figure>`;
 if(block.type==='file')return `<p><a href="/api/assets/${text(block.assetId)}">${text(block.alt||block.caption||'File')}</a></p>`;
 if(block.type==='tabs')return `<section>${block.tabs.map((tab,index)=>`<h3>${text(tab.title||`Tab ${index+1}`)}</h3>${decodeTabBody(tab.body)?printEditor(decodeTabBody(tab.body)!,staticMedia):`<p>${text(tab.body)}</p>`}`).join('')}</section>`;
 if(block.type==='accordion')return `<section>${block.items.map((item,index)=>`<article><h3>${text(item.title||`Question ${index+1}`)}</h3>${decodeTabBody(item.body)?printEditor(decodeTabBody(item.body)!,staticMedia):item.body?`<p>${text(item.body)}</p>`:''}</article>`).join('')}</section>`;
 if(block.type==='steps')return `<ol>${block.steps.map((step,index)=>`<li><h3>${text(step.title||`Step ${index+1}`)}</h3>${decodeTabBody(step.body)?printEditor(decodeTabBody(step.body)!,staticMedia):step.body?`<p>${text(step.body)}</p>`:''}</li>`).join('')}</ol>`;
 if(block.type==='columns')return `<section>${block.columns.map((column,index)=>`<article><h3>${text(column.title||`Column ${index+1}`)}</h3>${decodeTabBody(column.body)?printEditor(decodeTabBody(column.body)!,staticMedia):column.body?`<p>${text(column.body)}</p>`:''}</article>`).join('')}</section>`;
 if(block.type==='table')return `<table><thead><tr>${block.headers.map(header=>`<th>${text(header)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row=>`<tr>${row.map(cell=>`<td>${text(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 if(block.type==='button')return `<p><a href="${text(block.href)}">${text(block.label)}</a></p>`;
 if(block.type==='externalEmbed')return `<p>${block.caption?`${text(block.caption)} · `:''}<a href="${text(block.url)}">${text(block.url)}</a></p>`;
 if(block.type==='articleReference')return '<p>Referenced article</p>';
 return '';
}

/** Server-rendered reading copy. The interactive BlockNote reader replaces it after hydration. */
export function FumadocsBlockNoteStatic({blocks,locale}:{blocks:EditorBlock[];locale:'zh-CN'|'en'}){
 const html=printEditor(blocks,staticMedia).replace(
  /color:(?:black|#000(?:000)?(?:ff)?|rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1(?:\.0)?\))(?=;|")/gi,
  'color:var(--reader-neutral-ink,var(--fd-foreground))',
 );
 return <div
  className="fumadocs-blocknote-server"
  data-fumadocs-blocknote-reader=""
  data-fumadocs-blocknote-static=""
  lang={locale}
  dangerouslySetInnerHTML={{__html:html}}
 />;
}
