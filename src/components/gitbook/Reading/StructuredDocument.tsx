import {Fragment,type ReactNode,type CSSProperties} from 'react';
import {inlineText,isFileBlock,privateAssetId,type EditorBlock,type EditorInline} from '../../../editor/document';
import {displayColor} from '../../../editor/inline';
import {mediaAssetUrl} from '../../../history/paths';
import {CodeBlock} from '../RichBlocks/CodeBlock';
import {MediaBlocks} from '../Media/MediaBlocks';
/* eslint-disable @next/next/no-img-element -- private assets require session-aware delivery. */
const style=(p:{textColor?:string;backgroundColor?:string;textAlignment?:CSSProperties['textAlign']}):CSSProperties=>({color:displayColor(p.textColor),backgroundColor:displayColor(p.backgroundColor,true),textAlign:p.textAlignment});
export function StructuredInline({content}:{content:EditorInline[]}){
 return content.map((inline,index)=>{
  if(inline.type==='link')return <a key={index} href={inline.href} rel="noopener noreferrer"><StructuredInline content={inline.content}/></a>;
  let node:ReactNode=inline.text;
  if(inline.styles.code)node=<code>{node}</code>;if(inline.styles.bold)node=<strong>{node}</strong>;if(inline.styles.italic)node=<em>{node}</em>;if(inline.styles.underline)node=<u>{node}</u>;if(inline.styles.strike)node=<s>{node}</s>;
  return <span key={index} style={style(inline.styles)}>{node}</span>;
 });
}
export function StructuredDocument({blocks,documentId,revision,admin=false}:{blocks:EditorBlock[];documentId?:string;revision?:number;admin?:boolean}){
 const render=(nodes:EditorBlock[]):ReactNode[]=>{
  const result:ReactNode[]=[];
  for(let i=0;i<nodes.length;i++){
   const b=nodes[i],children=render(b.children);
   if(b.type==='juyu'){result.push(<Fragment key={b.id}><MediaBlocks blocks={[JSON.parse(b.props.payload)]} documentId={documentId} revision={revision} admin={admin}/>{children}</Fragment>);continue;}
   if(isFileBlock(b)){
    const id=privateAssetId(b.props.url);if(!id){result.push(<p key={b.id}>尚未添加文件</p>,...children);continue;}
    const url=mediaAssetUrl(id,admin,documentId,revision),p=b.props;
    result.push(<Fragment key={b.id}><figure className="native-file" style={style(p)}>
     {b.type==='image'&&p.showPreview!==false?<img src={url} alt={p.name} loading="lazy" style={{width:p.previewWidth,maxWidth:'100%'}}/>:b.type==='video'&&p.showPreview!==false?<video src={url} controls playsInline preload="metadata" style={{width:p.previewWidth,maxWidth:'100%'}} aria-label={p.name}><track kind="captions"/></video>:b.type==='audio'&&p.showPreview!==false?<audio src={url} controls preload="metadata" aria-label={p.name}/>:<a href={url} target="_blank" rel="noopener noreferrer">{p.name||'打开文件'}</a>}
     <figcaption>{p.caption}<a className="native-file-download" href={`${url}?download=1`} download>下载{p.name?' '+p.name:'文件'}</a></figcaption>
    </figure>{children}</Fragment>);continue;
   }
   if(b.type==='divider'){result.push(<Fragment key={b.id}><hr/>{children}</Fragment>);continue;}
   if(b.type==='table'){
    const c=b.content;const occupied:boolean[][]=c.rows.map(()=>[]);
    result.push(<Fragment key={b.id}><div className="reader-scroll-region" tabIndex={0} role="region" aria-label="资料表格，可横向滚动"><table style={style(b.props)}><colgroup>{c.columnWidths.map((w,j)=><col key={j} style={{width:w}}/>)}</colgroup><tbody>{c.rows.map((row,r)=>{let col=0;return <tr key={r}>{row.cells.map((cell,j)=>{while(occupied[r][col])col++;const header=r<(c.headerRows??0)||col<(c.headerCols??0),Tag=header?'th':'td';for(let y=r;y<r+(cell.props.rowspan??1);y++)for(let x=col;x<col+(cell.props.colspan??1);x++)occupied[y][x]=true;col+=cell.props.colspan??1;return <Tag key={j} colSpan={cell.props.colspan} rowSpan={cell.props.rowspan} style={style(cell.props)}><StructuredInline content={cell.content}/></Tag>;})}</tr>;})}</tbody></table></div>{children}</Fragment>);continue;
   }
   if(b.type==='bulletListItem'||b.type==='numberedListItem'){
    const type=b.type,items:ReactNode[]=[];while(i<nodes.length&&nodes[i].type===type){const item=nodes[i];if(item.type!=='bulletListItem'&&item.type!=='numberedListItem')break;items.push(<li key={item.id} value={type==='numberedListItem'?item.props.start:undefined} style={style(item.props)}><StructuredInline content={item.content}/>{render(item.children)}</li>);i++;}i--;
    result.push(type==='numberedListItem'?<ol key={b.id} start={b.props.start??1}>{items}</ol>:<ul key={b.id}>{items}</ul>);continue;
   }
   if(b.type==='codeBlock'){result.push(<Fragment key={b.id}><CodeBlock block={{id:b.id,type:'code',language:b.props.language??'text',code:inlineText(b.content)}}/>{children}</Fragment>);continue;}
   const Tag=b.type==='heading'?({1:'h2',2:'h3',3:'h4',4:'h5',5:'h6',6:'h6'} as const)[b.props.level??1]:b.type==='quote'?'blockquote':'p';
   const content=<StructuredInline content={b.content}/>;
   const heading=<Tag data-native-level={b.type==='heading'?b.props.level??1:undefined} id={b.type==='heading'?b.id:undefined} tabIndex={b.type==='heading'?-1:undefined} className={b.type==='heading'?'heading font-heading block gitbook-heading':undefined} style={style(b.props)}>{content}{b.type==='heading'&&<a href={`#${b.id}`} className="heading-hash" aria-label={`定位到：${inlineText(b.content)}`}>#</a>}</Tag>;
   if(b.type==='toggleListItem'||(b.type==='heading'&&b.props.isToggleable))result.push(<details key={b.id} className="native-toggle"><summary>{b.type==='heading'?heading:content}</summary>{children}</details>);
   else if(b.type==='checkListItem')result.push(<div key={b.id} className="native-check" style={style(b.props)}><input type="checkbox" checked={b.props.checked} disabled aria-label={inlineText(b.content)}/><div><span className={b.props.checked?"native-completed":undefined}>{content}</span>{children}</div></div>);
   else result.push(<Fragment key={b.id}>{heading}{b.children.length>0&&<div className="native-children">{children}</div>}</Fragment>);
  }return result;
 };
 return <>{render(blocks)}</>;
}
