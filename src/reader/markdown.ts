import {decodeEditorBody,inlineText,isFileBlock,privateAssetId,type EditorBlock,type EditorInline} from '../editor/document.ts';
import {annotationText} from '../editor/annotation.ts';
import {inlineEmbed} from '../editor/inline-embed.ts';
import {decodeTabBody} from '../media/tab-body.ts';
import type {MediaBlock} from '../media/model.ts';
import type {Publication} from './body.ts';

const escape=(value:string)=>value.replace(/[\\`*_{}\[\]()#+.!|>~-]/g,'\\$&');
const tableText=(value:string)=>value.replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
function inlineMarkdown(content:EditorInline[]):string{return content.map(part=>{
 if(part.type==='link'){
  const label=inlineMarkdown(part.content),note=annotationText(part.href),embed=inlineEmbed(part.href);
  if(note)return `${label}（注：${escape(note)}）`;
  if(embed?.type==='icon')return `:${embed.icon}:`;
  if(embed?.type==='math')return `$${embed.source.replace(/\$/g,'\\$')}$`;
  if(embed?.type==='image')return `![${escape(inlineText(part.content))}](/api/assets/${embed.assetId})`;
  return `[${label}](${part.href})`;
 }
 let result=escape(part.text);
 if(part.styles.code)result=`\`${part.text.replace(/`/g,'\\`')}\``;
 if(part.styles.bold)result=`**${result}**`;
 if(part.styles.italic)result=`*${result}*`;
 if(part.styles.strike)result=`~~${result}~~`;
 return result;
 }).join('');}
function mediaMarkdown(block:MediaBlock):string{
 if(block.type==='hint')return `> **${escape(block.title||'提示')}**\n> ${escape(block.body).replace(/\n/g,'\n> ')}`;
 if(block.type==='code')return `\`\`\`${block.language||'text'}\n${block.code}\n\`\`\``;
 if(block.type==='math')return `$$\n${block.source}\n$$`;
 if(block.type==='diagram')return `\`\`\`mermaid\n${block.source}\n\`\`\``;
 if(block.type==='image')return `![${escape(block.alt)}](/api/assets/${block.assetId})${block.caption?`\n\n${escape(block.caption)}`:''}`;
 if(block.type==='video'||block.type==='audio'||block.type==='file')return `[${escape(block.caption||block.alt||'打开附件')}](/api/assets/${block.assetId})`;
 if(block.type==='articleReference')return '引用文章（请在资料库内按权限打开）';
 if(block.type==='button')return `[${escape(block.label)}](${block.href})`;
 if(block.type==='externalEmbed')return `[${escape(block.caption||'打开外部内容')}](${block.url})`;
 if(block.type==='table')return [block.headers.map(tableText).join(' | '),block.headers.map(()=>'---').join(' | '),...block.rows.map(row=>row.map(tableText).join(' | '))].join('\n');
 if(block.type!=='tabs'&&block.type!=='steps'&&block.type!=='columns')return '';
 const items=block.type==='tabs'?block.tabs:block.type==='steps'?block.steps:block.columns;
 return items.map((item,index)=>`### ${block.type==='steps'?`${index+1}. `:''}${escape(item.title)}\n\n${decodeTabBody(item.body)?blocksMarkdown(decodeTabBody(item.body)!):escape(item.body)}`).join('\n\n');
}
function blocksMarkdown(blocks:EditorBlock[]):string{return blocks.map(block=>{
 let line='';
 if(block.type==='juyu')line=mediaMarkdown(JSON.parse(block.props.payload) as MediaBlock);
 else if(isFileBlock(block)){const id=privateAssetId(block.props.url);line=id?block.type==='image'?`![${escape(block.props.name)}](/api/assets/${id})`:`[${escape(block.props.name||'打开文件')}](/api/assets/${id})`:'';if(block.props.caption)line+=`\n\n${escape(block.props.caption)}`;}
 else if(block.type==='divider')line='---';
 else if(block.type==='table'){const rows=block.content.rows.map(row=>row.cells.map(cell=>tableText(inlineText(cell.content))));const columns=Math.max(1,...rows.map(row=>row.length));line=rows.length?[rows[0].join(' | '),Array.from({length:columns},()=>'---').join(' | '),...rows.slice(1).map(row=>row.join(' | '))].join('\n'):'';}
 else if(block.type==='codeBlock')line=`\`\`\`${block.props.language||'text'}\n${inlineText(block.content)}\n\`\`\``;
 else {const value=inlineMarkdown(block.content);
  line=block.type==='heading'?`${'#'.repeat(Math.min((block.props.level??1)+1,6))} ${value}`:
   block.type==='bulletListItem'?`- ${value}`:block.type==='numberedListItem'?`${block.props.start??1}. ${value}`:
   block.type==='checkListItem'?`- [${block.props.checked?'x':' '}] ${value}`:
   block.type==='quote'?`> ${value.replace(/\n/g,'\n> ')}`:value;
 }
 const children=block.children.length?blocksMarkdown(block.children).split('\n').map(child=>child?'  '+child:child).join('\n'):'';
 return [line,children].filter(Boolean).join('\n');
 }).filter(Boolean).join('\n\n');}
export function publicationMarkdown(article:Publication):string{
 const blocks=decodeEditorBody(article.body);
 const header=`# ${escape(article.title)}`;
 const description=article.description?`\n\n${escape(article.description)}`:'';
 const body=blocks===null?article.body.trim():blocksMarkdown(blocks);
 const media=blocks===null?(article.blocks??[]).map(mediaMarkdown).join('\n\n'):'';
 return `${header}${description}${body?`\n\n${body}`:''}${media?`\n\n${media}`:''}\n`;
}
