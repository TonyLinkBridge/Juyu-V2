import {Fragment,type ReactNode} from 'react';
import {inlineText,isFileBlock,privateAssetId,type EditorBlock} from '../../../editor/document';
import {StructuredInline,structuredStyle as style} from '../../reader-support/StructuredInline';
export {StructuredInline} from '../../reader-support/StructuredInline';
import {mediaAssetUrl} from '../../../history/paths';
import {CodeBlock} from '../RichBlocks/CodeBlock';
import {Hint} from '../RichBlocks/Hint';
import {MediaBlocks} from '../Media/MediaBlocks';
import {ImageGallery,type GalleryImage} from '../Media/ImageGallery';
import {tableCellBorderStyle,tableCellVerticalAlignStyle} from '../../../editor/table';
/* eslint-disable @next/next/no-img-element -- private assets require session-aware delivery. */
export function StructuredDocument({blocks,documentId,revision,admin=false,locale='zh-CN'}:{blocks:EditorBlock[];documentId?:string;revision?:number;admin?:boolean;locale?:'zh-CN'|'en'}){
 const render=(nodes:EditorBlock[]):ReactNode[]=>{
  const result:ReactNode[]=[];
  for(let i=0;i<nodes.length;i++){
   const b=nodes[i],children=render(b.children);
   if(b.type==='juyu'){const media=JSON.parse(b.props.payload);result.push(media.type==='reusableContent'?<section key={b.id} className="reader-reusable-content" aria-label={locale==='en'?`Reusable section: ${media.title}`:`共用片段：${media.title}`}>{children}</section>:media.type==='hint'?<Hint key={b.id} block={media}>{children}</Hint>:<Fragment key={b.id}><MediaBlocks blocks={[media]} documentId={documentId} revision={revision} admin={admin} locale={locale}/>{children}</Fragment>);continue;}
   if(isFileBlock(b)){
    if(b.type==='image'&&b.props.showPreview!==false&&privateAssetId(b.props.url)){
     const group:GalleryImage[]=[];
     let end=i;
     while(end<nodes.length){const candidate=nodes[end];if(candidate.type!=='image'||candidate.props.showPreview===false||!privateAssetId(candidate.props.url)||(end>i&&nodes[end-1].children.length>0))break;group.push({id:candidate.id,src:mediaAssetUrl(privateAssetId(candidate.props.url)!,admin,documentId,revision),alt:candidate.props.name,caption:candidate.props.caption,width:candidate.props.previewWidth,alignment:candidate.props.textAlignment});end++;}
     result.push(<Fragment key={b.id}><ImageGallery images={group}/>{children}</Fragment>);i=end-1;continue;
    }
    const id=privateAssetId(b.props.url);if(!id){result.push(<p key={b.id}>{locale==='en'?'No file attached yet.':'尚未添加文件'}</p>,...children);continue;}
    const url=mediaAssetUrl(id,admin,documentId,revision),p=b.props;
    result.push(<Fragment key={b.id}><figure className="native-file" style={style(p)}>
     {b.type==='image'&&p.showPreview!==false?<img src={url} alt={p.name} loading="lazy" style={{width:p.previewWidth,maxWidth:'100%'}}/>:b.type==='video'&&p.showPreview!==false?<video src={url} controls playsInline preload="metadata" style={{width:p.previewWidth,maxWidth:'100%'}} aria-label={p.name}><track kind="captions"/></video>:b.type==='audio'&&p.showPreview!==false?<audio src={url} controls preload="metadata" aria-label={p.name}/>:<a href={url} target="_blank" rel="noopener noreferrer">{p.name||(locale==='en'?'Open file':'打开文件')}</a>}
     <figcaption>{p.caption}<a className="native-file-download" href={`${url}?download=1`} download>{locale==='en'?'Download':'下载'}{p.name?' '+p.name:locale==='en'?' file':'文件'}</a></figcaption>
    </figure>{children}</Fragment>);continue;
   }
   if(b.type==='divider'){result.push(<Fragment key={b.id}><hr/>{children}</Fragment>);continue;}
   if(b.type==='table'){
    const c=b.content;const occupied:boolean[][]=c.rows.map(()=>[]);
    result.push(<Fragment key={b.id}><div className="reader-scroll-region" tabIndex={0} role="region" aria-label={locale==='en'?'Table; scroll horizontally to view more columns':'资料表格，可横向滚动'}><table style={style(b.props)}><colgroup>{c.columnWidths.map((w,j)=><col key={j} style={{width:w}}/>)}</colgroup><tbody>{c.rows.map((row,r)=>{let col=0;return <tr key={r}>{row.cells.map((cell,j)=>{while(occupied[r][col])col++;const column=col,header=r<(c.headerRows??0)||column<(c.headerCols??0),Tag=header?'th':'td';for(let y=r;y<r+(cell.props.rowspan??1);y++)for(let x=column;x<column+(cell.props.colspan??1);x++)occupied[y][x]=true;col=column+(cell.props.colspan??1);return <Tag key={j} colSpan={cell.props.colspan} rowSpan={cell.props.rowspan} style={{...style(cell.props),...tableCellBorderStyle(b.props.borderData,r,column),...tableCellVerticalAlignStyle(b.props.verticalAlignData,r,column)}}><StructuredInline content={cell.content} documentId={documentId} revision={revision} admin={admin} locale={locale}/></Tag>;})}</tr>;})}</tbody></table></div>{children}</Fragment>);continue;
   }
   if(b.type==='bulletListItem'||b.type==='numberedListItem'){
    const type=b.type,items:ReactNode[]=[];while(i<nodes.length&&nodes[i].type===type){const item=nodes[i];if(item.type!=='bulletListItem'&&item.type!=='numberedListItem')break;items.push(<li key={item.id} value={type==='numberedListItem'?item.props.start:undefined} style={style(item.props)}><StructuredInline content={item.content} documentId={documentId} revision={revision} admin={admin} locale={locale}/>{render(item.children)}</li>);i++;}i--;
    result.push(type==='numberedListItem'?<ol key={b.id} start={b.props.start??1}>{items}</ol>:<ul key={b.id}>{items}</ul>);continue;
   }
   if(b.type==='codeBlock'){result.push(<Fragment key={b.id}><CodeBlock block={{id:b.id,type:'code',language:b.props.language??'text',code:inlineText(b.content)}}/>{children}</Fragment>);continue;}
   const Tag=b.type==='heading'?({1:'h2',2:'h3',3:'h4',4:'h5',5:'h6',6:'h6'} as const)[b.props.level??1]:b.type==='quote'?'blockquote':'p';
   const content=<StructuredInline content={b.content} documentId={documentId} revision={revision} admin={admin} locale={locale}/>;
   const heading=<Tag data-native-level={b.type==='heading'?b.props.level??1:undefined} id={b.type==='heading'?b.id:undefined} tabIndex={b.type==='heading'?-1:undefined} className={b.type==='heading'?'heading font-heading block gitbook-heading':undefined} style={style(b.props)}>{content}{b.type==='heading'&&<a href={`#${b.id}`} className="heading-hash" aria-label={locale==='en'?`Jump to ${inlineText(b.content)}`:`定位到：${inlineText(b.content)}`}>#</a>}</Tag>;
   if(b.type==='toggleListItem'||(b.type==='heading'&&b.props.isToggleable))result.push(<details key={b.id} className="native-toggle"><summary>{b.type==='heading'?heading:content}</summary>{children}</details>);
   else if(b.type==='checkListItem')result.push(<div key={b.id} className="native-check" style={style(b.props)}><input type="checkbox" checked={b.props.checked} disabled aria-label={inlineText(b.content)}/><div><span className={b.props.checked?"native-completed":undefined}>{content}</span>{children}</div></div>);
   else result.push(<Fragment key={b.id}>{heading}{b.children.length>0&&<div className="native-children">{children}</div>}</Fragment>);
  }return result;
 };
 return <>{render(blocks)}</>;
}
