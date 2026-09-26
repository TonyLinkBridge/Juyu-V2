import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export async function navigationBrowserBundle(){
 const directory=resolve('output/verification/navigation-fixture');await mkdir(directory,{recursive:true});
const files=['reader/icon-keys.ts','reader/icon-components.ts','reader/icons.tsx','components/qa/QaView.tsx','components/qa/AuthenticatedQaAnswer.tsx','components/shell/NavigationLink.tsx','workspace/model.ts','lifecycle/client.ts','drafts/client.ts',...['DraftRowAction','TaskCard','TaskColumn','TasksBoard','TasksFilters','TasksList','TasksWorkspace'].map(n=>`components/tasks/${n}.tsx`),'components/feedback/feedback.ts','reader/content-path.ts','components/qa/QaAnswer.tsx','qa/presentation.ts','qa/answer-cache.ts','editor/inline.ts','editor/inline-embed.ts','editor/annotation.ts','editor/table.ts','editor/highlight.ts','editor/print.ts','navigation-settings/model.ts','components/navigation-settings/ReaderQuickLinks.tsx','fields/model.ts','fields/editor.ts','components/fields/FieldValues.tsx','analytics/search.ts','components/analytics/SearchAnalytics.tsx','analytics/client.ts','components/analytics/ArticleAnalytics.tsx','recent/client.ts','components/recent/RecentRecorder.tsx','favorites/client.ts','components/favorites/FavoriteButton.tsx','history/paths.ts','editor/document.ts','components/reader-support/InlineAnnotation.tsx','components/reader-support/StructuredInline.tsx','components/gitbook/Reading/StructuredDocument.tsx','science/model.ts','reader/inline.ts','reader/markdown.ts','components/science-fields.tsx','components/gitbook/Reading/Inline.tsx','components/gitbook/RichBlocks/Math.tsx','components/gitbook/RichBlocks/Diagram.tsx','components/rich-block-fields.tsx','components/editor/TabBodyEditor.tsx','components/editor/colors.ts',...['Hint.tsx','CodeBlock.tsx','CopyCodeButton.tsx','DynamicTabs.tsx','Steps.tsx','Columns.tsx'].map(f=>`components/gitbook/RichBlocks/${f}`),'media/model.ts','media/external-embed.ts','media/code-lines.ts','media/tab-body.ts','media/editor.ts','components/editor/TableConfigFields.tsx','components/editor/ArticleReferenceFields.tsx','components/editor/MediaFields.tsx','components/media-editor.tsx','components/reader-support/ArticleReferenceContext.tsx','components/gitbook/Media/ArticleReference.tsx','components/gitbook/RichBlocks/ActionButton.tsx','components/gitbook/Media/ImageGallery.tsx','components/reader-support/TableExplorer.tsx','components/gitbook/Media/ExternalEmbed.tsx','components/gitbook/Media/MediaBlocks.tsx','pdf/model.ts','pdf/render.ts','components/gitbook/PDF/PDFPage.tsx','components/gitbook/PDF/PrintButton.tsx','components/gitbook/PDF/PDFPrintControls.tsx','feedback/model.ts','components/feedback-dashboard.tsx','domain/presentation.ts','config/reader-presentation.ts','components/reader-chrome.tsx','components/gitbook/Footer/Footer.tsx','components/gitbook/Announcement/AnnouncementBanner.tsx','components/gitbook/Header/HeaderMobileMenu.tsx','reader/navigation.ts','reader/page-navigation.ts','reader/tree.ts','reader/body.ts','reader/search.ts','reader/recent-search.ts',...['SearchInput.tsx','SearchResults.tsx','SearchPageResultItem.tsx','SearchResultItem.tsx','HighlightQuery.tsx'].map(file=>`components/gitbook/Search/${file}`),'components/reader-support/PageFeedbackForm.tsx',...['DocumentView.tsx','Heading.tsx','Paragraph.tsx'].map(file=>`components/gitbook/Reading/${file}`),...['TableOfContents.tsx','PageGroupItem.tsx','ScrollContainer.tsx','PagesList.tsx','PageDocumentItem.tsx','ToggleableLinkItem.tsx','styles.ts'].map(file=>`components/gitbook/TableOfContents/${file}`)];
 files.push('components/qa/QaEditorialIndex.tsx');
 for(const file of files){const target=resolve(directory,file.replace(/\.tsx?$/,'.js'));await mkdir(dirname(target),{recursive:true});await writeFile(target,ts.transpileModule(await readFile(`src/${file}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,rewriteRelativeImportExtensions:true}}).outputText);}
 await writeFile(resolve(directory,'entry.js'),`
import React from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {MediaEditor} from './components/media-editor';
import {PDFPage} from './components/gitbook/PDF/PDFPage';
import {QaView} from './components/qa/QaView';
import {TasksWorkspace} from './components/tasks/TasksWorkspace';
import {QaAnswer} from './components/qa/QaAnswer';
import {FeedbackDashboard} from './components/feedback-dashboard';
import {ReaderQuickLinks} from './components/navigation-settings/ReaderQuickLinks';
import {FavoriteButton} from './components/favorites/FavoriteButton';
import {RecentRecorder} from './components/recent/RecentRecorder';
import {ArticleAnalytics} from './components/analytics/ArticleAnalytics';
import {SearchAnalytics} from './components/analytics/SearchAnalytics';
import {SearchInput} from './components/gitbook/Search/SearchInput';
import {SearchResults} from './components/gitbook/Search/SearchResults';
import {Footer} from './components/gitbook/Footer/Footer';
import {ReaderChrome} from './components/reader-chrome';
import {AnnouncementBanner} from './components/gitbook/Announcement/AnnouncementBanner';
import {TableOfContents} from './components/gitbook/TableOfContents/TableOfContents';
import {DocumentView} from './components/gitbook/Reading/DocumentView';
import {MediaBlocks} from './components/gitbook/Media/MediaBlocks';
import {FieldValues} from './components/fields/FieldValues';
import {PageFeedbackForm} from './components/reader-support/PageFeedbackForm';
import {ArticleReferenceProvider} from './components/reader-support/ArticleReferenceContext';
import {selectTreePage} from './reader/tree';
import {parseReaderBody} from './reader/body';
import {normalizePresentation} from './domain/presentation';
const h=React.createElement;
const data=JSON.parse(document.getElementById('data').textContent);
function visiblePages(nodes){const result=[];const visit=items=>{for(const node of items||[]){if(node.type==='group')visit(node.descendants);else result.push(node);}};visit(nodes);return result;}
function TestCover({article}){
 const [failed,setFailed]=React.useState(false),image=React.useRef(null);let cover=null;
 try{cover=normalizePresentation({cover:article.cover}).cover;}catch{}
 React.useEffect(()=>{setFailed(false);const node=image.current;if(node?.complete&&node.naturalWidth===0)queueMicrotask(()=>setFailed(true));},[cover?.assetId]);
 if(!cover)return null;
 return failed?h('p',{role:'status'},article.locale==='en'?'Cover image is unavailable':'封面暂时无法加载'):h('img',{ref:image,className:'reader-cover-image',src:'/api/assets/'+cover.assetId,alt:cover.alt,style:{objectPosition:'center '+cover.position+'%'},onError:()=>setFailed(true)});
}
function ReaderSurface(props){
 const pages=props.pages||[],locale=props.article?.locale||props.locale||'zh-CN',selected=props.failed?null:selectTreePage(pages,props.requested);
 const article=selected&&props.article?.id===selected.id&&!props.failed?props.article:null;
 const document=article?parseReaderBody(article.body):null,unavailable=!props.failed&&props.requested!==undefined&&!article;
 const articleActions=article&&(props.favorites||props.recent||props.analytics)?h('div',{className:'reader-actions'},props.favorites?h(FavoriteButton,{documentId:article.id,revision:article.revision}):null,props.recent?h(RecentRecorder,{documentId:article.id,revision:article.revision}):null,props.analytics?h(ArticleAnalytics,{documentId:article.id,revision:article.revision}):null):null;
 let presentation={tags:[],cover:null,blocks:[]};if(article)try{presentation=normalizePresentation(article);}catch{}
 return h('div',{className:'reader-layout'},
  h(TableOfContents,{section:props.section,pages:props.failed?[]:pages,currentPagePath:selected?.href||'',failed:props.failed,locale}),
  article&&document?h('main',{id:'main-content',className:'reader-main reader-test-surface'},
   h(TestCover,{article}),
   h('header',{className:'reader-test-header'},h('h1',null,article.title),article.description&&h('p',{className:'reader-description'},article.description),h('p',{className:'reader-description reader-test-meta'},locale==='en'?'Published version '+(article.publicationNumber||article.revision):'正式版本 '+(article.publicationNumber||article.revision))),
   presentation.tags.length?h('ul',{className:'reader-tags','aria-label':locale==='en'?'Article tags':'文章标签'},...presentation.tags.map(tag=>h('li',{key:tag},tag))):null,
   articleActions,
   props.features?.pdfExport===false?null:h('a',{className:'secondary-link',href:'/api/articles/'+encodeURIComponent(article.id)+'/pdf?revision='+article.revision},locale==='en'?'Read / export PDF':'PDF 阅读／导出'),
   h(FieldValues,{fields:article.customFields,locale}),
   h(ArticleReferenceProvider,{pages:visiblePages(pages),aliases:props.referenceAliases,locale},
    (document.editorBlocks?.length||document.blocks.length)?h(DocumentView,{document,documentId:article.id,revision:article.revision,locale}):h('p',{className:'reader-description'},locale==='en'?'This article has no body yet.':'这篇文章暂时没有正文。'),
    !document.editorBlocks&&h(MediaBlocks,{blocks:presentation.blocks,documentId:article.id,revision:article.revision,locale})
   ),
   props.features?.feedback===false?null:h(PageFeedbackForm,{documentId:article.id,revision:article.revision,initial:article.feedback?.value,publicationNumber:article.publicationNumber,locale})
  ):h('main',{id:'main-content',className:'reader-main'},h('p',{className:'reader-eyebrow'},locale==='en'?'Team knowledge':'员工资料库'),h('h1',null,locale==='en'?(props.failed?'The article directory is unavailable':unavailable?'This article is unavailable':'Welcome to the Help Centre'):props.failed?'目录暂时无法加载':unavailable?'文章暂不可用':'欢迎使用资料库'),h('p',{className:'reader-description'},locale==='en'?(props.failed?'We couldn’t load the article directory. Please try again.':unavailable?'You can choose another published article from the directory.':pages.length?'Choose an article from the directory.':'Published articles you can read will appear here.'):props.failed?'暂时无法取得资料目录，请重新加载。若持续失败，请联系管理员。':unavailable?'该文章目前无法阅读。你可以从目录选择其他已发布资料。':pages.length?'从文章目录选择你需要的资料。':'有你可以阅读的文章发布后，会显示在这里。'),props.failed&&h('a',{className:'secondary-link',href:locale==='en'?'/help-centre/library?lang=en':'/help-centre'},locale==='en'?'Try again':'重新加载'),props.actions&&h('div',{className:'reader-actions'},props.actions))
 );
}
const reader=data.qaView?h(QaView,data.qaView):data.pendingWorkspace?h(TasksWorkspace,data.pendingWorkspace):data.qaAnswer?h(QaAnswer,data.qaAnswer):data.mediaEditor?h('main',{id:'main-content',className:'members-main'},h('h1',null,'媒体与表格 · 本地示例'),h(MediaEditor,{initial:data.mediaEditor})):data.pdfSnapshot?h(PDFPage,{snapshot:data.pdfSnapshot}):data.feedbackDashboard?h('main',{id:'main-content',className:'members-main'},h('h1',null,'文章反馈 · 本地示例'),h(FeedbackDashboard,data.feedbackDashboard)):data.search?h('div',{className:'reader-search-layout'},(data.analytics?h(SearchAnalytics,{search:data.search,enabled:!data.failed},h(SearchResults,{search:data.search,failed:data.failed,retryHref:data.retryHref})):h(SearchResults,{search:data.search,failed:data.failed,retryHref:data.retryHref}))):h(ReaderSurface,data);
if(document.getElementById('search-input'))createRoot(document.getElementById('search-input')).render(h(SearchInput,{query:data.search?.query??''}));
if(document.getElementById('reader'))createRoot(document.getElementById('reader')).render(reader);
if(document.getElementById('presentation')){
 const content=h('div',{className:'flex min-h-dvh flex-col'},h(ReaderChrome,null,h('header',{className:'site-header has-search'},h('span',{className:'brand-name'},'JUYU · 本地示例'),data.feedbackDashboard?h('span',{className:'internal-label'},'内部资料库'):h(SearchInput,{query:data.search?.query??''})),data.quickLinks&&h(ReaderQuickLinks,data.quickLinks),data.announcement&&h(AnnouncementBanner,{announcement:data.announcement})),reader,h(Footer));
 const root=document.getElementById('presentation');
 // Exercise server snapshots and hydration, without a public auth bypass route.
 root.innerHTML=renderToString(content);
 const hydrate=()=>{const mounted=hydrateRoot(root,content,{onRecoverableError:error=>{root.dataset.hydrationError=String(error);}});window.updatePendingWorkspace=props=>mounted.render(h(TasksWorkspace,props));};
 if(data.hydrateAfterImages)Promise.all([...root.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))).then(hydrate);
 else hydrate();
}
`);
 await writeFile(resolve(directory,'clerk.js'),`export function useAuth(){return {isLoaded:true,userId:'fixture',sessionId:'fixture-session'};}`);
 await writeFile(resolve(directory,'next-link.js'),`import React from 'react';export function useLinkStatus(){return {pending:false};}export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`);
 await writeFile(resolve(directory,'next-form.js'),`import React from 'react';export default function Form(props){return React.createElement('form',props);}`);
 await writeFile(resolve(directory,'next-navigation.js'),`export function usePathname(){return '/help-centre';}export function useRouter(){return {prefetch(){}};}`);
 const {webpack}=require('next/dist/compiled/webpack/webpack');
 await new Promise<void>((done,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:resolve(directory,'entry.js'),output:{path:directory,filename:'bundle.js',publicPath:'/__navigation_assets/'},resolve:{modules:[resolve('node_modules')],alias:{'next/form':resolve(directory,'next-form.js'),'@clerk/nextjs':resolve(directory,'clerk.js'),'next/link':resolve(directory,'next-link.js'),'next/navigation':resolve(directory,'next-navigation.js')}},module:{rules:[{test:/\.m?js$/,resolve:{fullySpecified:false}}]}});compiler.run((error:Error|null,stats:{hasErrors():boolean;toString():string})=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):done()));});
 const cssFiles=(await readdir('.next/static/chunks')).filter(file=>file.endsWith('.css')).sort();
 if(!cssFiles.length)throw new Error('Run the production build before navigation browser verification');
 // The production build contains route-specific Fumadocs base CSS in a separate
 // chunk. This neutral test surface concatenates chunks, so restore the product
 // shell's own page colors after concatenation instead of testing an impossible
 // mixture of both route roots.
 const css=(await Promise.all(cssFiles.map(file=>readFile(resolve('.next/static/chunks',file),'utf8')))).join('\n');
 return {script:await readFile(resolve(directory,'bundle.js'),'utf8'),css:`${css}\nhtml,body{background:var(--surface);color:var(--ink)}`};
}
