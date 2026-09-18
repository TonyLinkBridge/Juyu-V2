import {inlineText,isFileBlock,privateAssetId,type EditorBlock,type EditorInline} from './document.ts';
import {displayColor} from './inline.ts';
import type {MediaBlock} from '../media/model.ts';
const e=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const css=(p:{textAlignment?:string;textColor?:string;backgroundColor?:string})=>e([p.textAlignment?`text-align:${p.textAlignment}`:'',p.backgroundColor==='red'?'color:#fff':p.textColor&&p.textColor!=='default'?`color:${displayColor(p.textColor)}`:'',p.backgroundColor&&p.backgroundColor!=='default'?`background-color:${displayColor(p.backgroundColor,true)}`:''].filter(Boolean).join(';'));
function marks(content:EditorInline[]):string{return content.map(inline=>{if(inline.type==='link')return `<a href="${e(inline.href)}" rel="noopener noreferrer">${marks(inline.content)}</a>`;let html=e(inline.text);for(const [mark,tag] of [['code','code'],['bold','strong'],['italic','em'],['underline','u'],['strike','s']] as const)if(inline.styles[mark])html=`<${tag}>${html}</${tag}>`;const s=css(inline.styles);return s?`<span style="${s}">${html}</span>`:html;}).join('');}
/** Print expands all folded children. Media bytes still come only from the existing authorized exporter. */
export function printEditor(nodes:EditorBlock[],media:(b:MediaBlock)=>string):string{
 const render=(nodes:EditorBlock[]):string=>{
  let html='';for(let i=0;i<nodes.length;i++){const b=nodes[i];
   if(b.type==='juyu'){html+=media(JSON.parse(b.props.payload))+render(b.children);continue;}
   if(isFileBlock(b)){if(b.props.url){const rendered=media({id:b.id,type:b.type,assetId:privateAssetId(b.props.url)!,caption:b.props.caption,alt:b.props.name});html+=b.type==='image'&&b.props.previewWidth?`<div style="width:${b.props.previewWidth}px;max-width:100%">${rendered}</div>`:rendered;}html+=render(b.children);continue;}
   if(b.type==='divider'){html+='<hr>'+render(b.children);continue;}
   if(b.type==='table'){const t=b.content;const occupied:boolean[][]=t.rows.map(()=>[]);html+=`<table style="${css(b.props)}"><colgroup>${t.columnWidths.map(w=>`<col${w?` style="width:${w}px"`:''}>`).join('')}</colgroup><tbody>`;t.rows.forEach((r,y)=>{let x=0;html+='<tr>';for(const cell of r.cells){while(occupied[y][x])x++;const tag=y<(t.headerRows??0)||x<(t.headerCols??0)?'th':'td',p=cell.props;for(let dy=y;dy<y+(p.rowspan??1);dy++)for(let dx=x;dx<x+(p.colspan??1);dx++)occupied[dy][dx]=true;x+=p.colspan??1;html+=`<${tag} colspan="${p.colspan??1}" rowspan="${p.rowspan??1}" style="${css(p)}">${marks(cell.content)}</${tag}>`;}html+='</tr>';});html+='</tbody></table>'+render(b.children);continue;}
   if(b.type==='bulletListItem'||b.type==='numberedListItem'){const type=b.type,tag=type==='numberedListItem'?'ol':'ul';html+=`<${tag}${tag==='ol'?` start="${b.props.start??1}"`:''}>`;while(i<nodes.length&&nodes[i].type===type){const item=nodes[i];if(item.type!=='bulletListItem'&&item.type!=='numberedListItem')break;html+=`<li${tag==='ol'&&item.props.start!==undefined?` value="${item.props.start}"`:''} style="${css(item.props)}">${marks(item.content)}${render(item.children)}</li>`;i++;}i--;html+=`</${tag}>`;continue;}
   if(b.type==='codeBlock'){html+=`<section class="pdf-code"><p>${e(b.props.language??'text')}</p><pre><code>${e(inlineText(b.content))}</code></pre></section>${render(b.children)}`;continue;}
   // Match the reader: completion decorates only the item's label, not nested children.
   const label=marks(b.content),content=b.type==='checkListItem'&&b.props.checked?`<span style="text-decoration:line-through">${label}</span>`:label;
   const tag=b.type==='heading'?`h${Math.min((b.props.level??1)+1,6)}`:b.type==='quote'?'blockquote':'p';html+=`<${tag}${b.type==='heading'?` id="${b.id}"`:''} style="${css(b.props)}">${b.type==='checkListItem'?(b.props.checked?'☑ ':'☐ '):''}${content}</${tag}>${b.children.length?`<div style="padding-left:6mm">${render(b.children)}</div>`:''}`;
  }return html;
 };return render(nodes);
}
