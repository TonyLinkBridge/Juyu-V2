'use client';
/* eslint-disable @next/next/no-img-element -- published inline images use the private session-protected endpoint. */

import {BlockNoteSchema,createCodeBlockSpec,defaultBlockSpecs,defaultInlineContentSpecs,defaultStyleSpecs} from '@blocknote/core';
import * as blockNoteLocales from '@blocknote/core/locales';
import {createReactDiagramBlockSpec,locales as diagramLocales} from '@blocknote/diagram-block';
import {BlockNoteView} from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import {createReactMathBlockSpec,locales as mathLocales} from '@blocknote/math-block';
import {createReactBlockSpec,createReactInlineContentSpec,useCreateBlockNote} from '@blocknote/react';
import {Callout} from 'fumadocs-ui/components/callout';
import {Card} from 'fumadocs-ui/components/card';
import {DynamicCodeBlock} from 'fumadocs-ui/components/dynamic-codeblock';
import {File,Files} from 'fumadocs-ui/components/files';
import {ImageZoom} from 'fumadocs-ui/components/image-zoom';
import {Step,Steps} from 'fumadocs-ui/components/steps';
import {Tabs,TabsContent,TabsList,TabsTrigger} from 'fumadocs-ui/components/tabs';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import {useTheme} from 'fumadocs-ui/provider/base';
import {useEffect,useMemo,useRef,useState} from 'react';
import {normalizeEditorBlocks,type EditorBlock,type EditorInline} from '../../editor/document';
import {inlineText,screenInlineStyle} from '../../editor/inline';
import {inlineEmbed} from '../../editor/inline-embed';
import {annotationText} from '../../editor/annotation';
import {borderTableSpec} from '../../editor/blocknote-table';
import {tableCellBorderStyle,tableCellVerticalAlignStyle} from '../../editor/table';
import {nativeBackgroundColor,nativeTextColor} from '../editor/colors';
import {readerIconKey,type ReaderIconKey} from '../../reader/icon-keys';
import {ReaderIcon} from '../../reader/icons';
import {mathMarkup} from '../../science/model';
import {decodeTabBody} from '../../media/tab-body';
import {codeLineNumbers} from '../../media/code-lines';
import {normalizeBlocks,type MediaBlock,type ScienceBlock,type TextBlock} from '../../media/model';
import {externalEmbedSource,externalLinkSource} from '../../media/external-embed';
// Reviewed JUYU adapters: BlockNote renders the main document. These four
// preserve authorized references, custom inline data and interactive data
// tables for stored content that has no equivalent Fumadocs component.
import {StructuredInline} from '../reader-support/StructuredInline';
import {InlineAnnotation} from '../reader-support/InlineAnnotation';
import {ArticleReferenceProvider,useAuthorizedReference,useReaderLocale} from '../reader-support/ArticleReferenceContext';
import {TableExplorer} from '../reader-support/TableExplorer';
import type {NavigationPage} from '../../reader/navigation';

type ReaderLocale='zh-CN'|'en';

type PreviewHint={
 type:'hint';
 style:'info'|'success'|'warning'|'danger';
 title:string;
 body:string;
 showTitle?:boolean;
 readerChildren?:EditorBlock[];
 readerLocale?:ReaderLocale;
};

type PreviewTabs={
 type:'tabs';
 tabs:{id:string;title:string;body:string;iconKey?:ReaderIconKey|null}[];
 readerLocale?:ReaderLocale;
};

type PreviewSteps={
 type:'steps';
 steps:{id:string;title:string;body:string}[];
 readerLocale?:ReaderLocale;
};

type PreviewColumns={
 type:'columns';
 columns:{id:string;title:string;body:string}[];
 readerLocale?:ReaderLocale;
};

type PreviewCode={
 type:'readerCode';
 language:string;
 code:string;
 readerLocale?:ReaderLocale;
};

type PreviewAdvancedCode=Extract<TextBlock,{type:'code'}>&{readerLocale?:ReaderLocale};

type PreviewImage={
 type:'readerImage';
 src:string;
 darkSrc?:string;
 alt:string;
 caption:string;
 width?:number;
 alignment:'left'|'center'|'right'|'justify';
 showPreview:boolean;
 readerLocale?:ReaderLocale;
};

type PreviewMedia={
 type:'readerMedia';
 kind:'video'|'audio'|'file';
 src:string;
 name:string;
 caption:string;
 width?:number;
 alignment:'left'|'center'|'right'|'justify';
 showPreview:boolean;
 readerLocale?:ReaderLocale;
};

type PreviewTable={type:'readerTable';table:Extract<EditorBlock,{type:'table'}>;readerLocale?:ReaderLocale};
type AdvancedTable=Extract<MediaBlock,{type:'table'}>;

const OfficialFumadocsTable=defaultMdxComponents.table;
const OfficialFumadocsLink=defaultMdxComponents.a;

const supportedCodeLanguages:Record<string,{name:string}>={text:{name:'纯文本'},javascript:{name:'JavaScript'},typescript:{name:'TypeScript'},json:{name:'JSON'},html:{name:'HTML'},css:{name:'CSS'},python:{name:'Python'},sql:{name:'SQL'},bash:{name:'Shell'},yaml:{name:'YAML'},markdown:{name:'Markdown'}};

function readHint(payload:string):PreviewHint|null{
 try{
  const value=JSON.parse(payload) as Partial<PreviewHint>;
  if(value.type!=='hint'||!['info','success','warning','danger'].includes(String(value.style))||typeof value.title!=='string'||typeof value.body!=='string'||(value.readerChildren!==undefined&&!Array.isArray(value.readerChildren)))return null;
  return value as PreviewHint;
 }catch{return null;}
}

function isReusableContent(payload:string,blockId:string):boolean{
 try{
  const value=JSON.parse(payload) as Record<string,unknown>;
  return value.type==='reusableContent'
   &&value.id===blockId
   &&typeof value.familyId==='string'
   &&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.familyId)
   &&Number.isSafeInteger(value.version)
   &&Number(value.version)>=1
   &&Number(value.version)<=100000
   &&typeof value.title==='string'
   &&value.title.trim().length>0
   &&value.title.length<=120;
 }catch{return false;}
}

function FumadocsHint({hint,blockId}:{hint:PreviewHint;blockId:string}){
 const type=hint.style==='danger'?'error':hint.style;
 return <Callout data-fumadocs-callout={blockId} type={type} title={hint.showTitle===false?undefined:hint.title}>
  {hint.body&&<p>{hint.body}</p>}
  {hint.readerChildren?.length?<PublishedBlockNoteStatic blocks={hint.readerChildren} locale={hint.readerLocale??'zh-CN'}/>:null}
 </Callout>;
}

function readTabs(payload:string):PreviewTabs|null{
 try{
  const value=JSON.parse(payload) as Partial<PreviewTabs>;
  if(value.type!=='tabs'||!Array.isArray(value.tabs)||value.tabs.length<1||value.tabs.length>8||value.readerLocale!==undefined&&!['zh-CN','en'].includes(value.readerLocale))return null;
  const ids=new Set<string>();
  const tabs:PreviewTabs['tabs']=[];
  for(const item of value.tabs){
   if(!item||typeof item!=='object'||typeof item.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(item.id)||ids.has(item.id)||typeof item.title!=='string'||item.title.length>100||typeof item.body!=='string'||item.body.length>20000)return null;
   const iconKey=item.iconKey===undefined||item.iconKey===null?item.iconKey:readerIconKey(item.iconKey);
   if(item.iconKey!==undefined&&item.iconKey!==null&&iconKey===null)return null;
   ids.add(item.id);tabs.push({id:item.id,title:item.title,body:item.body,...(iconKey===undefined?{}:{iconKey})});
  }
  return {type:'tabs',tabs,...(value.readerLocale?{readerLocale:value.readerLocale}:{})};
 }catch{return null;}
}

function FumadocsTabs({tabs,blockId}:{tabs:PreviewTabs;blockId:string}){
 const locale=tabs.readerLocale??'zh-CN';
 const label=(title:string,index:number)=>title.trim()||(locale==='en'?`Tab ${index+1}`:`标签 ${index+1}`);
 return <Tabs data-fumadocs-tabs={blockId} defaultValue={tabs.tabs[0].id}>
  <TabsList aria-label={locale==='en'?'Content tabs':'内容标签'}>{tabs.tabs.map((tab,index)=>{
   const icon=tab.iconKey?readerIconKey(tab.iconKey):null;
   return <TabsTrigger key={tab.id} value={tab.id}>{icon&&<ReaderIcon icon={icon} size={16} className=""/>}{label(tab.title,index)}</TabsTrigger>;
  })}</TabsList>
  {tabs.tabs.map(tab=>{
   const body=decodeTabBody(tab.body);
   return <TabsContent key={tab.id} value={tab.id}>{body?<PublishedBlockNoteStatic blocks={body} locale={locale}/>:<p>{tab.body}</p>}</TabsContent>;
  })}
 </Tabs>;
}

function readSteps(payload:string):PreviewSteps|null{
 try{
  const value=JSON.parse(payload) as Partial<PreviewSteps>;
  if(value.type!=='steps'||!Array.isArray(value.steps)||value.steps.length<1||value.steps.length>20||value.readerLocale!==undefined&&!['zh-CN','en'].includes(value.readerLocale))return null;
  const ids=new Set<string>();
  const steps:PreviewSteps['steps']=[];
  for(const item of value.steps){
   if(!item||typeof item!=='object'||typeof item.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(item.id)||ids.has(item.id)||typeof item.title!=='string'||item.title.length>120||typeof item.body!=='string'||item.body.length>20000)return null;
   ids.add(item.id);steps.push({id:item.id,title:item.title,body:item.body});
  }
  return {type:'steps',steps,...(value.readerLocale?{readerLocale:value.readerLocale}:{})};
 }catch{return null;}
}

function FumadocsSteps({steps,blockId}:{steps:PreviewSteps;blockId:string}){
 const locale=steps.readerLocale??'zh-CN';
 const label=(title:string,index:number)=>title.trim()||(locale==='en'?`Step ${index+1}`:`步骤 ${index+1}`);
 return <section data-fumadocs-steps={blockId} aria-label={locale==='en'?'Steps':'操作步骤'}><Steps>{steps.steps.map((step,index)=>{
  const body=decodeTabBody(step.body);
  return <Step key={step.id}><h3>{label(step.title,index)}</h3>{body?<PublishedBlockNoteStatic blocks={body} locale={locale}/>:<p>{step.body}</p>}</Step>;
 })}</Steps></section>;
}

function readColumns(payload:string):PreviewColumns|null{
 try{
  const value=JSON.parse(payload) as Partial<PreviewColumns>;
  if(value.type!=='columns'||!Array.isArray(value.columns)||value.columns.length<2||value.columns.length>3||value.readerLocale!==undefined&&!['zh-CN','en'].includes(value.readerLocale))return null;
  const ids=new Set<string>();
  const columns:PreviewColumns['columns']=[];
  for(const item of value.columns){
   if(!item||typeof item!=='object'||typeof item.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(item.id)||ids.has(item.id)||typeof item.title!=='string'||item.title.length>120||typeof item.body!=='string'||item.body.length>20000)return null;
   ids.add(item.id);columns.push({id:item.id,title:item.title,body:item.body});
  }
  return {type:'columns',columns,...(value.readerLocale?{readerLocale:value.readerLocale}:{})};
 }catch{return null;}
}

function FumadocsColumns({columns,blockId}:{columns:PreviewColumns;blockId:string}){
 const locale=columns.readerLocale??'zh-CN';
 const label=(title:string,index:number)=>title.trim()||(locale==='en'?`Column ${index+1}`:`第 ${index+1} 栏`);
 return <section className="fumadocs-reader-columns not-prose" data-fumadocs-columns={blockId} data-column-count={columns.columns.length} aria-label={locale==='en'?'Column layout':'分栏内容'}>{columns.columns.map((column,index)=>{
  const body=decodeTabBody(column.body);
  return <article key={column.id}><h3>{label(column.title,index)}</h3>{body?<PublishedBlockNoteStatic blocks={body} locale={locale}/>:column.body?<p>{column.body}</p>:null}</article>;
 })}</section>;
}

function readCode(payload:string):PreviewCode|null{
 try{
  const value=JSON.parse(payload) as Partial<PreviewCode>;
  if(value.type!=='readerCode'||typeof value.language!=='string'||value.language.length>80||typeof value.code!=='string'||value.code.length>200000||value.readerLocale!==undefined&&!['zh-CN','en'].includes(value.readerLocale))return null;
  return value as PreviewCode;
 }catch{return null;}
}

function FumadocsCode({code,blockId}:{code:PreviewCode;blockId:string}){
 const locale=code.readerLocale??'zh-CN';
 const language=code.language.trim()||'text';
 const title=supportedCodeLanguages[language]?.name||(language==='text'?(locale==='en'?'Plain text':'纯文本'):language);
 return <div className="fumadocs-reader-code" data-fumadocs-code={blockId}><DynamicCodeBlock lang={language} code={code.code} codeblock={{title}}/></div>;
}

function readAdvancedCode(payload:string):PreviewAdvancedCode|null{
 try{
  const value=JSON.parse(payload) as Record<string,unknown>;
  const readerLocale=value.readerLocale;
  if(readerLocale!==undefined&&!['zh-CN','en'].includes(String(readerLocale)))return null;
  const stored={...value};delete stored.readerLocale;
  const block=normalizeBlocks([stored])[0];
  if(block.type!=='code')return null;
  return {...block,...(readerLocale?{readerLocale:readerLocale as ReaderLocale}:{})};
 }catch{return null;}
}

function FumadocsAdvancedCode({code,blockId}:{code:PreviewAdvancedCode;blockId:string}){
 const locale=code.readerLocale??'zh-CN';
 const [expanded,setExpanded]=useState(false);
 const language=code.language.trim()||'text';
 const languageName=supportedCodeLanguages[language]?.name||(language==='text'?(locale==='en'?'Plain text':'纯文本'):language);
 const title=code.title?`${code.title}${code.language?` · ${languageName}`:''}`:languageName;
 const lines=code.code.split('\n');
 const collapsedLines=code.collapsedLines??10;
 const canCollapse=Boolean(code.expandable&&lines.length>collapsedLines);
 const isExpanded=!canCollapse||expanded;
 const highlighted=codeLineNumbers(code.highlightLines),added=codeLineNumbers(code.addedLines),removed=codeLineNumbers(code.removedLines);
 return <div className="fumadocs-reader-code" data-fumadocs-advanced-code={blockId} data-expanded={String(isExpanded)}>
  <DynamicCodeBlock
   lang={language}
   code={code.code}
   codeblock={{
    title,
    className:code.wrap?'fumadocs-code-wrap':undefined,
    'data-line-numbers':code.lineNumbers||undefined,
    viewportProps:{
     'aria-label':locale==='en'?'Code; scroll horizontally to view long lines':'代码内容，可横向滚动',
     className:`fumadocs-code-viewport ${isExpanded?'is-expanded':'is-collapsed'}`,
     style:{'--juyu-code-visible-lines':collapsedLines} as React.CSSProperties,
    },
   }}
   options={{themes:{light:'github-light',dark:'github-dark'},transformers:[{name:'juyu-fumadocs-code-lines',line(node,line){
    const names=removed.has(line)?['diff','remove']:added.has(line)?['diff','add']:highlighted.has(line)?['highlighted']:[];
    for(const name of names)this.addClassToHast(node,name);
   }}]}}
  />
  {canCollapse&&<button type="button" className={buttonVariants({variant:'outline',size:'sm',className:'mt-2'})} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{locale==='en'?(expanded?'Show less':`Show all ${lines.length} lines`):(expanded?'收起代码':`展开全部 ${lines.length} 行`)}</button>}
 </div>;
}

function readImage(payload:string):PreviewImage|null{
 try{
  const value=JSON.parse(payload) as Partial<PreviewImage>;
  if(value.type!=='readerImage'||typeof value.src!=='string'||!/^\/api\/assets\/[0-9a-f-]{36}$/i.test(value.src)||value.darkSrc!==undefined&&(typeof value.darkSrc!=='string'||!/^\/api\/assets\/[0-9a-f-]{36}$/i.test(value.darkSrc))||typeof value.alt!=='string'||typeof value.caption!=='string'||typeof value.showPreview!=='boolean'||!['left','center','right','justify'].includes(String(value.alignment))||value.width!==undefined&&(!Number.isFinite(value.width)||value.width<1||value.width>10000)||value.readerLocale!==undefined&&!['zh-CN','en'].includes(value.readerLocale))return null;
  return value as PreviewImage;
 }catch{return null;}
}

function readAdvancedImage(payload:string,locale:ReaderLocale):PreviewImage|null{
 try{
  const block=normalizeBlocks([JSON.parse(payload)])[0];
  if(block.type!=='image')return null;
  return {type:'readerImage',src:`/api/assets/${block.assetId}`,...(block.darkAssetId?{darkSrc:`/api/assets/${block.darkAssetId}`}:{ }),alt:block.alt,caption:block.caption,alignment:'left',showPreview:true,readerLocale:locale};
 }catch{return null;}
}

function FumadocsImage({image,blockId}:{image:PreviewImage;blockId:string}){
 const {resolvedTheme}=useTheme();
 const locale=image.readerLocale??'zh-CN';
 const src=resolvedTheme==='dark'&&image.darkSrc?image.darkSrc:image.src;
 const label=image.alt||(locale==='en'?'Article image':'文章图片');
 const figureStyle=image.width?{width:`min(${image.width}px, 100%)`}:undefined;
 return <figure className="fumadocs-reader-image not-prose" data-fumadocs-image={blockId} data-image-alignment={image.alignment} style={figureStyle}>
  {image.showPreview?<ImageZoom src={src} alt={label} zoomInProps={{src,alt:label}} rmiz={{children:null,a11yNameButtonZoom:locale==='en'?'Expand image':'放大图片',a11yNameButtonUnzoom:locale==='en'?'Minimize image':'关闭大图'}}><img src={src} alt={label} loading="lazy"/></ImageZoom>:null}
  <figcaption>
   {image.caption&&<p>{image.caption}</p>}
   <div className="fumadocs-reader-image-actions"><a className={buttonVariants({variant:'outline',size:'sm'})} href={src} target="_blank" rel="noopener noreferrer">{locale==='en'?'Open original':'打开原文件'}</a><a className={buttonVariants({variant:'ghost',size:'sm'})} href={`${src}?download=1`} download>{locale==='en'?'Download':'下载文件'}</a></div>
  </figcaption>
 </figure>;
}

function readMedia(payload:string):PreviewMedia|null{
 try{
  const value=JSON.parse(payload) as Partial<PreviewMedia>;
  if(value.type!=='readerMedia'||!['video','audio','file'].includes(String(value.kind))||typeof value.src!=='string'||!/^\/api\/assets\/[0-9a-f-]{36}$/i.test(value.src)||typeof value.name!=='string'||typeof value.caption!=='string'||typeof value.showPreview!=='boolean'||!['left','center','right','justify'].includes(String(value.alignment))||value.width!==undefined&&(!Number.isFinite(value.width)||value.width<1||value.width>10000)||value.readerLocale!==undefined&&!['zh-CN','en'].includes(value.readerLocale))return null;
  return value as PreviewMedia;
 }catch{return null;}
}

function readAdvancedMedia(payload:string,locale:ReaderLocale):PreviewMedia|null{
 try{
  const block=normalizeBlocks([JSON.parse(payload)])[0];
  if(block.type!=='video'&&block.type!=='audio'&&block.type!=='file')return null;
  return {type:'readerMedia',kind:block.type,src:`/api/assets/${block.assetId}`,name:block.alt,caption:block.caption,alignment:'left',showPreview:block.type!=='file',readerLocale:locale};
 }catch{return null;}
}

function FumadocsMedia({media,blockId}:{media:PreviewMedia;blockId:string}){
 const locale=media.readerLocale??'zh-CN';
 const label=media.name||(media.kind==='video'?(locale==='en'?'Article video':'文章影片'):media.kind==='audio'?(locale==='en'?'Article audio':'文章音频'):(locale==='en'?'Attachment':'附件'));
 const figureStyle=media.width?{width:`min(${media.width}px, 100%)`}:undefined;
 const attachment=media.kind==='file'||!media.showPreview;
 return <figure className="fumadocs-reader-media not-prose" data-fumadocs-media={blockId} data-media-kind={media.kind} data-media-alignment={media.alignment} style={figureStyle}>
  {media.kind==='video'&&media.showPreview?<video src={media.src} controls playsInline preload="metadata" aria-label={label}><track kind="captions"/></video>:null}
  {media.kind==='audio'&&media.showPreview?<audio src={media.src} controls preload="metadata" aria-label={label}/>:null}
  {attachment?<Files><a href={media.src} target="_blank" rel="noopener noreferrer"><File name={label}/></a></Files>:null}
  <figcaption>
   {media.caption&&<p>{media.caption}</p>}
   <div className="fumadocs-reader-image-actions"><a className={buttonVariants({variant:'outline',size:'sm'})} href={media.src} target="_blank" rel="noopener noreferrer">{locale==='en'?'Open original':media.kind==='file'?'打开文件':'打开原文件'}</a><a className={buttonVariants({variant:'ghost',size:'sm'})} href={`${media.src}?download=1`} download>{locale==='en'?'Download':'下载文件'}</a></div>
  </figcaption>
 </figure>;
}

function readTable(payload:string):PreviewTable|null{
 try{
  const value=JSON.parse(payload) as Partial<PreviewTable>;
  if(value.type!=='readerTable'||!value.table||value.readerLocale!==undefined&&!['zh-CN','en'].includes(value.readerLocale))return null;
  const table=normalizeEditorBlocks([value.table])[0];
  if(table.type!=='table')return null;
  return {type:'readerTable',table,readerLocale:value.readerLocale};
 }catch{return null;}
}

function FumadocsTable({value,blockId}:{value:PreviewTable;blockId:string}){
 const {table}=value,locale=value.readerLocale??'zh-CN',occupied:boolean[][]=table.content.rows.map(()=>[]);
 const widths=table.content.columnWidths;
 const minimumWidth=widths.every(width=>typeof width==='number')?widths.reduce<number>((sum,width)=>sum+(width??0),0):undefined;
 return <OfficialFumadocsTable data-fumadocs-table={blockId} aria-label={locale==='en'?'Article table':'文章表格'} className="fumadocs-reader-table" style={{...screenInlineStyle({textColor:table.props.textColor}),minWidth:minimumWidth}}>
  <colgroup>{widths.map((width,index)=><col key={index} style={width?{width}:undefined}/>)}</colgroup>
  <tbody>{table.content.rows.map((row,rowIndex)=>{let column=0;return <tr key={rowIndex}>{row.cells.map((cell,cellIndex)=>{
   while(occupied[rowIndex][column])column++;
   const logicalColumn=column,rowspan=cell.props.rowspan??1,colspan=cell.props.colspan??1;
   for(let rowCursor=rowIndex;rowCursor<rowIndex+rowspan;rowCursor++)for(let columnCursor=logicalColumn;columnCursor<logicalColumn+colspan;columnCursor++)occupied[rowCursor][columnCursor]=true;
   column=logicalColumn+colspan;
   const header=rowIndex<(table.content.headerRows??0)||logicalColumn<(table.content.headerCols??0),Cell=header?'th':'td';
   return <Cell key={cellIndex} rowSpan={cell.props.rowspan} colSpan={cell.props.colspan} style={{...screenInlineStyle(cell.props),textAlign:cell.props.textAlignment,...tableCellBorderStyle(table.props.borderData,rowIndex,logicalColumn),...tableCellVerticalAlignStyle(table.props.verticalAlignData,rowIndex,logicalColumn)}}><FumadocsStructuredInline content={cell.content} locale={locale}/></Cell>;
  })}</tr>;})}</tbody>
 </OfficialFumadocsTable>;
}

function readAdvancedTable(payload:string):AdvancedTable|null{
 try{
  const table=normalizeBlocks([JSON.parse(payload)])[0];
  return table.type==='table'?table:null;
 }catch{return null;}
}

function FumadocsAdvancedTable({table,blockId}:{table:AdvancedTable;blockId:string}){
 return <div className="fumadocs-reader-data-table not-prose" data-fumadocs-advanced-table={blockId}><TableExplorer block={table}/></div>;
}

function readScience(payload:string):ScienceBlock|null{
 try{
  const value=JSON.parse(payload) as Record<string,unknown>;
  const block=normalizeBlocks([{id:value.id,type:value.type,source:value.source,caption:value.caption}])[0];
  return block.type==='math'||block.type==='diagram'?block:null;
 }catch{return null;}
}

function readArticleReference(payload:string):Extract<import('../../media/model').MediaBlock,{type:'articleReference'}>|null{
 try{
  const value=JSON.parse(payload) as Record<string,unknown>;
  const block=normalizeBlocks([{id:value.id,type:value.type,targetId:value.targetId}])[0];
  return block.type==='articleReference'?block:null;
 }catch{return null;}
}

function FumadocsArticleReference({reference,blockId}:{reference:Extract<import('../../media/model').MediaBlock,{type:'articleReference'}>;blockId:string}){
 const page=useAuthorizedReference(reference.targetId),english=useReaderLocale()==='en';
 if(!page)return <div data-fumadocs-article-reference={blockId}><Card title={english?'Referenced article unavailable':'引用资料暂不可用'} description={english?'This referenced article is unavailable.':'引用的资料目前无法阅读。'}/></div>;
 return <div data-fumadocs-article-reference={blockId}><Card href={page.href} icon={<ReaderIcon icon={page.iconKey??'file'} size={18} className=""/>} title={page.title} description={page.description}/></div>;
}

function readActionButton(payload:string):Extract<MediaBlock,{type:'button'}>|null{
 try{
  const value=JSON.parse(payload) as Record<string,unknown>;
  const block=normalizeBlocks([{id:value.id,type:value.type,label:value.label,href:value.href,variant:value.variant}])[0];
  return block.type==='button'?block:null;
 }catch{return null;}
}

function actionButtonProps(button:Extract<MediaBlock,{type:'button'}>){
 const external=/^https?:\/\//i.test(button.href);
 return {
  className:buttonVariants({variant:button.variant}),
  href:button.href,
  ...(external?{target:'_blank' as const,rel:'noopener noreferrer'}:{}),
 };
}

function FumadocsActionButton({button,blockId}:{button:Extract<MediaBlock,{type:'button'}>;blockId:string}){
 return <a data-fumadocs-action-button={blockId} {...actionButtonProps(button)}>{button.label}</a>;
}

function readExternalEmbed(payload:string):Extract<MediaBlock,{type:'externalEmbed'}>|null{
 try{
  const value=JSON.parse(payload) as Record<string,unknown>;
  const block=normalizeBlocks([{id:value.id,type:value.type,url:value.url,caption:value.caption}])[0];
  return block.type==='externalEmbed'?block:null;
 }catch{return null;}
}

function FumadocsExternalEmbed({embed,blockId}:{embed:Extract<MediaBlock,{type:'externalEmbed'}>;blockId:string}){
 const english=useReaderLocale()==='en';
 const [loaded,setLoaded]=useState(false),source=externalEmbedSource(embed.url),link=externalLinkSource(embed.url);
 if(!link)return <Callout type="warn" title={english?'External content unavailable':'外部内容暂不可用'}>{english?'This external address is invalid.':'外部内容地址无效。'}</Callout>;
 if(!source)return <figure className="my-5" data-fumadocs-external-embed={blockId}>
  <Callout type="info" title={`${english?'External link':'外部链接'} · ${link.host}`}>
   <p>{english?'This site cannot be previewed here. The link opens in a new tab.':'这个网站不支持站内预览。点击链接后会在新页面打开。'}</p>
   <a className={buttonVariants({variant:'outline',size:'sm',className:'mt-2'})} href={link.original} target="_blank" rel="noopener noreferrer">{english?'Open website':'打开外部网站'}</a>
  </Callout>
  {embed.caption&&<figcaption className="mt-2 text-sm text-fd-muted-foreground">{embed.caption}</figcaption>}
 </figure>;
 return <figure className="my-5" data-fumadocs-external-embed={blockId}>
  {loaded?<iframe title={embed.caption||(english?`${source.provider} content`:`${source.provider} 外部内容`)} src={source.frame} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="fullscreen; picture-in-picture" allowFullScreen className="block min-h-[min(32rem,70vh)] w-full rounded-xl border border-fd-border bg-fd-muted max-sm:min-h-64"/>:<Callout type="info" title={english?`${source.provider} content`:`${source.provider} 内容`}>
   <p>{english?'This content is hosted elsewhere. Your browser will connect to that site only when you choose to load it.':'此内容由外部网站提供。点击后浏览器才会连接该网站。'}</p>
   <button type="button" className={buttonVariants({variant:'outline',size:'sm',className:'mt-2'})} onClick={()=>setLoaded(true)}>{english?'Load external content':'加载外部内容'}</button>
  </Callout>}
  <figcaption className="mt-2 text-sm text-fd-muted-foreground">{embed.caption&&<><span>{embed.caption}</span> · </>}<OfficialFumadocsLink href={source.original}>{english?`Open on ${source.provider}`:`到 ${source.provider} 打开`}</OfficialFumadocsLink></figcaption>
 </figure>;
}

function FumadocsStructuredInline({content,locale}:{content:EditorInline[];locale:ReaderLocale}){
 return <>{content.map((item,index)=>{
  if(item.type==='text')return <StructuredInline key={index} content={[item]} locale={locale}/>;
  const label=inlineText(item.content),embed=inlineEmbed(item.href),note=annotationText(item.href);
  if(note)return <InlineAnnotation key={index} note={note}><StructuredInline content={item.content} locale={locale}/></InlineAnnotation>;
  if(embed?.type==='icon')return <span key={index} className="inline-reader-icon" data-fumadocs-inline-icon="" role="img" aria-label={label||(locale==='en'?'Icon':'图标')}><ReaderIcon icon={embed.icon} size={17} className=""/></span>;
  if(embed?.type==='math'){
   let html='';try{html=mathMarkup(embed.source,false);}catch{return <code key={index}>{embed.source}</code>;}
   return <span key={index} className="inline-reader-math" data-fumadocs-inline-math="" aria-label={embed.source} dangerouslySetInnerHTML={{__html:html}}/>;
  }
  if(embed?.type==='image'){
   const src=`/api/assets/${encodeURIComponent(embed.assetId)}`,alt=label||(locale==='en'?'Inline image':'行内图片');
   return <ImageZoom key={index} src={src} alt={alt} zoomInProps={{src,alt}} rmiz={{children:null,a11yNameButtonZoom:locale==='en'?'Expand inline image':'放大行内图片',a11yNameButtonUnzoom:locale==='en'?'Minimize inline image':'关闭行内图片'}}><img className="inline-reader-image" data-fumadocs-inline-image="" src={src} alt={alt} loading="lazy"/></ImageZoom>;
  }
  return <OfficialFumadocsLink key={index} data-fumadocs-inline-link="" href={item.href}><StructuredInline content={item.content} locale={locale}/></OfficialFumadocsLink>;
 })}</>;
}

const juyuBlock=createReactBlockSpec({
 type:'juyu',
 propSchema:{payload:{default:''}},
 content:'none',
},{
 render:({block})=>{
  const hint=readHint(block.props.payload);
  if(hint)return <FumadocsHint hint={hint} blockId={block.id}/>;
  const tabs=readTabs(block.props.payload);
  if(tabs)return <FumadocsTabs tabs={tabs} blockId={block.id}/>;
  const steps=readSteps(block.props.payload);
  if(steps)return <FumadocsSteps steps={steps} blockId={block.id}/>;
  const columns=readColumns(block.props.payload);
  if(columns)return <FumadocsColumns columns={columns} blockId={block.id}/>;
  const code=readCode(block.props.payload);
  if(code)return <FumadocsCode code={code} blockId={block.id}/>;
  const advancedCode=readAdvancedCode(block.props.payload);
  if(advancedCode)return <FumadocsAdvancedCode code={advancedCode} blockId={block.id}/>;
  const image=readImage(block.props.payload);
  if(image)return <FumadocsImage image={image} blockId={block.id}/>;
  const media=readMedia(block.props.payload);
  if(media)return <FumadocsMedia media={media} blockId={block.id}/>;
  const table=readTable(block.props.payload);
  if(table)return <FumadocsTable value={table} blockId={block.id}/>;
  const advancedTable=readAdvancedTable(block.props.payload);
  if(advancedTable)return <FumadocsAdvancedTable table={advancedTable} blockId={block.id}/>;
  const reference=readArticleReference(block.props.payload);
  if(reference)return <FumadocsArticleReference reference={reference} blockId={block.id}/>;
  const action=readActionButton(block.props.payload);
  if(action)return <FumadocsActionButton button={action} blockId={block.id}/>;
  const embed=readExternalEmbed(block.props.payload);
  if(embed)return <FumadocsExternalEmbed embed={embed} blockId={block.id}/>;
  return <Callout type="warning" title="Unsupported custom block">This validation page has not connected this custom block yet.</Callout>;
 },
 toExternalHTML:({block})=>{
  const hint=readHint(block.props.payload);
  if(hint)return <p>{[hint.title,hint.body].filter(Boolean).join(': ')}</p>;
  const action=readActionButton(block.props.payload);
  if(action)return <a data-fumadocs-action-button={block.id} {...actionButtonProps(action)}>{action.label}</a>;
  const embed=readExternalEmbed(block.props.payload),link=embed&&externalLinkSource(embed.url);
  return embed&&link?<a href={link.original} target="_blank" rel="noopener noreferrer">{embed.caption||link.host}</a>:<p/>;
 },
});

const juyuInline=createReactInlineContentSpec({type:'juyuInline',propSchema:{kind:{default:'icon',values:['icon','math','image'] as const},value:{default:''},label:{default:''}},content:'none'}, {
 render:({inlineContent})=>{
  const {kind,value,label}=inlineContent.props;
  if(kind==='icon'){const icon=readerIconKey(value);return <span className="inline-reader-icon" data-fumadocs-inline-icon="" role="img" aria-label={label||'图标'} contentEditable={false}>{icon?<ReaderIcon icon={icon} size={17} className=""/>:'◇'}</span>;}
  if(kind==='math'){let html='';try{html=mathMarkup(value,false);}catch{return <code contentEditable={false}>{value}</code>;}return <span className="inline-reader-math" data-fumadocs-inline-math="" aria-label={value} contentEditable={false} dangerouslySetInnerHTML={{__html:html}}/>;}
  const src=`/api/assets/${encodeURIComponent(value)}`,alt=label||'行内图片';
  return <ImageZoom src={src} alt={alt} zoomInProps={{src,alt}} rmiz={{children:null,a11yNameButtonZoom:'放大行内图片',a11yNameButtonUnzoom:'关闭行内图片'}}><img className="inline-reader-image" data-fumadocs-inline-image="" src={src} alt={alt} contentEditable={false} loading="lazy"/></ImageZoom>;
 },
 toExternalHTML:({inlineContent})=><span>{inlineContent.props.label||inlineContent.props.value}</span>,
});

const fumadocsLink=createReactInlineContentSpec({type:'fumadocsLink',propSchema:{href:{default:''}},content:'styled'}, {
 render:({inlineContent,contentRef})=><OfficialFumadocsLink data-fumadocs-inline-link="" href={inlineContent.props.href}><span ref={contentRef}/></OfficialFumadocsLink>,
 toExternalHTML:({inlineContent,contentRef})=>{
  const external=/^\w+:|^\/\//.test(inlineContent.props.href);
  return <a data-fumadocs-inline-link="" href={inlineContent.props.href} {...(external?{target:'_blank',rel:'noreferrer noopener'}:{})}><span ref={contentRef}/></a>;
 },
});

const fumadocsAnnotation=createReactInlineContentSpec({type:'fumadocsAnnotation',propSchema:{note:{default:''}},content:'styled'}, {
 render:({inlineContent,contentRef})=><InlineAnnotation note={inlineContent.props.note}><span ref={contentRef}/></InlineAnnotation>,
 toExternalHTML:({contentRef})=><span ref={contentRef}/>,
});

function toFumadocsInline(content:EditorInline[]){
 return content.map(item=>{
  if(item.type==='text')return item;
  const embed=inlineEmbed(item.href);
  if(embed)return {type:'juyuInline' as const,props:{kind:embed.type,value:embed.type==='icon'?embed.icon:embed.type==='math'?embed.source:embed.assetId,label:inlineText(item.content)}};
  const note=annotationText(item.href);
  if(note)return {type:'fumadocsAnnotation' as const,props:{note},content:item.content};
  return {type:'fumadocsLink' as const,props:{href:item.href},content:item.content};
 });
}

function publishedBlocks(nodes:EditorBlock[],locale:ReaderLocale):unknown[]{
 return nodes.flatMap(block=>{
 if(block.type==='juyu'){
   if(isReusableContent(block.props.payload,block.id))return publishedBlocks(block.children,locale);
   const hint=readHint(block.props.payload);
   if(hint)return {...block,props:{payload:JSON.stringify({...hint,readerChildren:block.children,readerLocale:locale})},children:[]};
   const tabs=readTabs(block.props.payload);
   if(tabs)return {...block,props:{payload:JSON.stringify({...tabs,readerLocale:locale})},children:[]};
   const steps=readSteps(block.props.payload);
   if(steps)return {...block,props:{payload:JSON.stringify({...steps,readerLocale:locale})},children:[]};
   const columns=readColumns(block.props.payload);
   if(columns)return {...block,props:{payload:JSON.stringify({...columns,readerLocale:locale})},children:[]};
   const advancedCode=readAdvancedCode(block.props.payload);
   if(advancedCode)return {...block,props:{payload:JSON.stringify({...advancedCode,readerLocale:locale})},children:[]};
   const advancedImage=readAdvancedImage(block.props.payload,locale);
   if(advancedImage)return {...block,props:{payload:JSON.stringify(advancedImage)},children:publishedBlocks(block.children,locale)};
   const advancedMedia=readAdvancedMedia(block.props.payload,locale);
   if(advancedMedia)return {...block,props:{payload:JSON.stringify(advancedMedia)},children:publishedBlocks(block.children,locale)};
   const science=readScience(block.props.payload);
   if(science){
    const nativeBlock={id:block.id,type:science.type==='math'?'mathBlock':'diagram',content:science.source,children:publishedBlocks(block.children,locale)};
    if(!science.caption.trim())return nativeBlock;
    return [nativeBlock,{id:`${block.id}-caption`,type:'paragraph',content:science.caption,children:[]}];
   }
  }
  if(block.type==='image'){
   const image:PreviewImage={type:'readerImage',src:block.props.url,alt:block.props.name,caption:block.props.caption,width:block.props.previewWidth,alignment:block.props.textAlignment??'left',showPreview:block.props.showPreview!==false,readerLocale:locale};
   return {id:block.id,type:'juyu',props:{payload:JSON.stringify(image)},children:publishedBlocks(block.children,locale)};
  }
  if(block.type==='video'||block.type==='audio'||block.type==='file'){
   const media:PreviewMedia={type:'readerMedia',kind:block.type,src:block.props.url,name:block.props.name,caption:block.props.caption,width:block.type==='video'?block.props.previewWidth:undefined,alignment:block.type==='video'?block.props.textAlignment??'left':'left',showPreview:block.type==='file'?false:block.props.showPreview!==false,readerLocale:locale};
   return {id:block.id,type:'juyu',props:{payload:JSON.stringify(media)},children:publishedBlocks(block.children,locale)};
  }
  if(block.type==='codeBlock')return {id:block.id,type:'juyu',props:{payload:JSON.stringify({type:'readerCode',language:block.props.language??'',code:inlineText(block.content),readerLocale:locale} satisfies PreviewCode)},children:publishedBlocks(block.children,locale)};
  const children=publishedBlocks(block.children,locale);
  if(block.type==='table')return {id:block.id,type:'juyu',props:{payload:JSON.stringify({type:'readerTable',table:{...block,children:[]},readerLocale:locale} satisfies PreviewTable)},children};
  if('content' in block)return {...block,content:toFumadocsInline(block.content as EditorInline[]),children};
  return {...block,children};
 });
}

function createReaderSchema(nodes:EditorBlock[]=[]){
 const supportedLanguages:Record<string,{name:string}>={...supportedCodeLanguages};
 const visit=(items:EditorBlock[])=>{for(const item of items){if(item.type==='codeBlock'&&item.props.language&&!supportedLanguages[item.props.language])supportedLanguages[item.props.language]={name:item.props.language};visit(item.children);}};
 visit(nodes);
 return BlockNoteSchema.create({
  blockSpecs:{...defaultBlockSpecs,table:borderTableSpec,codeBlock:createCodeBlockSpec({supportedLanguages}),mathBlock:createReactMathBlockSpec(),diagram:createReactDiagramBlockSpec(),juyu:juyuBlock()},
  inlineContentSpecs:{...defaultInlineContentSpecs,juyuInline,fumadocsLink,fumadocsAnnotation},
  styleSpecs:{...defaultStyleSpecs,textColor:nativeTextColor,backgroundColor:nativeBackgroundColor},
 });
}

function BlockNoteDocument({schemaNodes,initialContent,locale}:{schemaNodes:EditorBlock[];initialContent:unknown[];locale:ReaderLocale}){
 const root=useRef<HTMLDivElement>(null);
 const {resolvedTheme}=useTheme();
 const schema=useMemo(()=>createReaderSchema(schemaNodes),[schemaNodes]);
 const editor=useCreateBlockNote({
  schema,
  initialContent:initialContent as typeof schema.PartialBlock[],
  dictionary:{...(locale==='en'?blockNoteLocales.en:blockNoteLocales.zh),math:locale==='en'?mathLocales.en:mathLocales.zh,diagram:locale==='en'?diagramLocales.en:diagramLocales.zh},
  resolveFileUrl:async url=>url,
 },[schema,initialContent]);
 useEffect(()=>{
  for(const heading of root.current?.querySelectorAll<HTMLElement>('[data-content-type="heading"]')??[]){
   const block=heading.closest<HTMLElement>('[data-id]');
   const title=heading.querySelector<HTMLElement>('h1,h2,h3,h4,h5,h6');
   if(block?.dataset.id&&title)title.id=block.dataset.id;
  }
 },[editor]);
 return <div ref={root} className="not-prose" data-fumadocs-blocknote-reader=""><BlockNoteView editor={editor} editable={false} theme={resolvedTheme==='dark'?'dark':'light'}/></div>;
}

function PublishedBlockNote({blocks,locale}:{blocks:EditorBlock[];locale:ReaderLocale}){
 const initialContent=useMemo(()=>publishedBlocks(blocks,locale),[blocks,locale]);
 return <BlockNoteDocument schemaNodes={blocks} initialContent={initialContent} locale={locale}/>;
}

function PublishedBlockNoteStatic({blocks,locale}:{blocks:EditorBlock[];locale:ReaderLocale}){
 const {resolvedTheme}=useTheme();
 const initialContent=useMemo(()=>publishedBlocks(blocks,locale),[blocks,locale]);
 const schema=useMemo(()=>createReaderSchema(blocks),[blocks]);
 const editor=useCreateBlockNote({schema,initialContent:initialContent as typeof schema.PartialBlock[],dictionary:{...(locale==='en'?blockNoteLocales.en:blockNoteLocales.zh),math:locale==='en'?mathLocales.en:mathLocales.zh,diagram:locale==='en'?diagramLocales.en:diagramLocales.zh}},[schema,initialContent,locale]);
 const [html,setHtml]=useState('');
 useEffect(()=>{
  let active=true;
  queueMicrotask(()=>{if(active)setHtml(editor.blocksToFullHTML());});
  return ()=>{active=false;};
 },[editor]);
 return <BlockNoteView editor={editor} editable={false} renderEditor={false} theme={resolvedTheme==='dark'?'dark':'light'} data-fumadocs-blocknote-static=""><div dangerouslySetInnerHTML={{__html:html}}/></BlockNoteView>;
}

export function FumadocsBlockNoteReaderClient({blocks,published=false,locale='zh-CN',referencePages=[],referenceAliases={}}:{blocks:unknown[];published?:boolean;locale?:ReaderLocale;documentId?:string;revision?:number;referencePages?:NavigationPage[];referenceAliases?:Record<string,string>}){
 const stored=useMemo(()=>published?blocks as EditorBlock[]:[],[blocks,published]);
 return <ArticleReferenceProvider pages={referencePages} aliases={referenceAliases} locale={locale}>{published?<PublishedBlockNote blocks={stored} locale={locale}/>:<BlockNoteDocument schemaNodes={stored} initialContent={blocks} locale={locale}/>}</ArticleReferenceProvider>;
}
