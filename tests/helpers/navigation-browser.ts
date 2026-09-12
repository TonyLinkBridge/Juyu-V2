import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export async function navigationBrowserBundle(){
 const directory=resolve('output/verification/navigation-fixture');await mkdir(directory,{recursive:true});
 const files=['reader/content-path.ts','components/qa/QaAnswer.tsx','qa/presentation.ts','editor/inline.ts','editor/table.ts','editor/highlight.ts','editor/print.ts','navigation-settings/model.ts','reader/category-page.ts','components/navigation-settings/ReaderQuickLinks.tsx','components/navigation-settings/CategoryLanding.tsx','fields/model.ts','fields/editor.ts','components/fields/FieldValues.tsx','analytics/search.ts','components/analytics/SearchAnalytics.tsx','analytics/client.ts','components/analytics/ArticleAnalytics.tsx','recent/client.ts','components/recent/RecentRecorder.tsx','favorites/client.ts','components/favorites/FavoriteButton.tsx','history/paths.ts','editor/document.ts','components/gitbook/Reading/StructuredInline.tsx','components/gitbook/Reading/StructuredDocument.tsx','science/model.ts','reader/inline.ts','components/science-fields.tsx','components/gitbook/Reading/Inline.tsx','components/gitbook/RichBlocks/Math.tsx','components/gitbook/RichBlocks/Diagram.tsx','components/rich-block-fields.tsx',...['Hint.tsx','CodeBlock.tsx','CopyCodeButton.tsx','DynamicTabs.tsx'].map(f=>`components/gitbook/RichBlocks/${f}`),'media/model.ts','media/editor.ts','components/media-editor.tsx','components/gitbook/Media/MediaBlocks.tsx','pdf/model.ts','pdf/render.ts','components/gitbook/PDF/PDFPage.tsx','components/gitbook/PDF/PrintButton.tsx','components/gitbook/PDF/PDFPrintControls.tsx','feedback/model.ts','components/feedback-dashboard.tsx','domain/presentation.ts','reader/theme.ts','config/reader-presentation.ts','components/reader-chrome.tsx','components/gitbook/ThemeToggler/ThemeToggler.tsx','components/gitbook/Footer/Footer.tsx','components/gitbook/Announcement/AnnouncementBanner.tsx','components/reader-navigation.tsx','components/gitbook/Header/HeaderMobileMenu.tsx','reader/navigation.ts','reader/page-navigation.ts','reader/tree.ts','reader/body.ts','reader/search.ts',...['SearchInput.tsx','SearchResults.tsx','SearchPageResultItem.tsx','SearchResultItem.tsx','HighlightQuery.tsx'].map(file=>`components/gitbook/Search/${file}`),...['PageFeedbackForm.tsx','PageCover.tsx','PageCoverImage.tsx','PageTags.tsx','PageHeader.tsx','PageFooterNavigation.tsx','ScrollToTopButton.tsx','PageBody.tsx','DocumentView.tsx','Heading.tsx','Paragraph.tsx','PageAside.tsx','ScrollSectionsList.tsx','useScrollActiveId.ts'].map(file=>`components/gitbook/Reading/${file}`),...['TableOfContents.tsx','PageGroupItem.tsx','ScrollContainer.tsx','PagesList.tsx','PageDocumentItem.tsx','ToggleableLinkItem.tsx','styles.ts'].map(file=>`components/gitbook/TableOfContents/${file}`)];
 for(const file of files){const target=resolve(directory,file.replace(/\.tsx?$/,'.js'));await mkdir(dirname(target),{recursive:true});await writeFile(target,ts.transpileModule(await readFile(`src/${file}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,rewriteRelativeImportExtensions:true}}).outputText);}
 await writeFile(resolve(directory,'entry.js'),`
import React from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {MediaEditor} from './components/media-editor';
import {PDFPage} from './components/gitbook/PDF/PDFPage';
import {QaAnswer} from './components/qa/QaAnswer';
import {FeedbackDashboard} from './components/feedback-dashboard';
import {ReaderNavigation} from './components/reader-navigation';
import {ReaderQuickLinks} from './components/navigation-settings/ReaderQuickLinks';
import {CategoryLanding} from './components/navigation-settings/CategoryLanding';
import {FavoriteButton} from './components/favorites/FavoriteButton';
import {RecentRecorder} from './components/recent/RecentRecorder';
import {ArticleAnalytics} from './components/analytics/ArticleAnalytics';
import {SearchAnalytics} from './components/analytics/SearchAnalytics';
import {SearchInput} from './components/gitbook/Search/SearchInput';
import {SearchResults} from './components/gitbook/Search/SearchResults';
import {Footer} from './components/gitbook/Footer/Footer';
import {ReaderChrome} from './components/reader-chrome';
import {AnnouncementBanner} from './components/gitbook/Announcement/AnnouncementBanner';
const h=React.createElement;
const data=JSON.parse(document.getElementById('data').textContent);
const reader=data.qaAnswer?h(QaAnswer,data.qaAnswer):data.categoryLanding?h('main',{id:'main-content',className:'editor-main search-main'},h(CategoryLanding,data.categoryLanding)):data.mediaEditor?h('main',{id:'main-content',className:'members-main'},h('h1',null,'媒体与表格 · 本地示例'),h(MediaEditor,{initial:data.mediaEditor})):data.pdfSnapshot?h(PDFPage,{snapshot:data.pdfSnapshot}):data.feedbackDashboard?h('main',{id:'main-content',className:'members-main'},h('h1',null,'文章反馈 · 本地示例'),h(FeedbackDashboard,data.feedbackDashboard)):data.search?h('div',{className:'reader-search-layout'},(data.analytics?h(SearchAnalytics,{search:data.search,enabled:!data.failed},h(SearchResults,{search:data.search,failed:data.failed,retryHref:data.retryHref})):h(SearchResults,{search:data.search,failed:data.failed,retryHref:data.retryHref}))):h(ReaderNavigation,{...data,...((data.favorites||data.recent||data.analytics)&&data.article?{articleActions:h('div',null,data.favorites?h(FavoriteButton,{documentId:data.article.id,revision:data.article.revision}):null,data.recent?h(RecentRecorder,{documentId:data.article.id,revision:data.article.revision}):null,data.analytics?h(ArticleAnalytics,{documentId:data.article.id,revision:data.article.revision}):null)}:{})});
if(document.getElementById('search-input'))createRoot(document.getElementById('search-input')).render(h(SearchInput,{query:data.search?.query??''}));
if(document.getElementById('reader'))createRoot(document.getElementById('reader')).render(reader);
if(document.getElementById('presentation')){
 const content=h('div',{className:'flex min-h-dvh flex-col'},h(ReaderChrome,null,h('header',{className:'site-header has-search'},h('span',{className:'brand-name'},'JUYU · 本地示例'),data.feedbackDashboard?h('span',{className:'internal-label'},'内部资料库'):h(SearchInput,{query:data.search?.query??''})),data.quickLinks&&h(ReaderQuickLinks,data.quickLinks),data.announcement&&h(AnnouncementBanner,{announcement:data.announcement})),reader,h(Footer));
 const root=document.getElementById('presentation');
 // Exercise server snapshots and hydration, without a public auth bypass route.
 root.innerHTML=renderToString(content);
 const hydrate=()=>hydrateRoot(root,content,{onRecoverableError:error=>{root.dataset.hydrationError=String(error);}});
 if(data.hydrateAfterImages)Promise.all([...root.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))).then(hydrate);
 else hydrate();
}
`);
 await writeFile(resolve(directory,'next-link.js'),`import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`);
 await writeFile(resolve(directory,'next-navigation.js'),`export function usePathname(){return '/help-centre';}`);
 const {webpack}=require('next/dist/compiled/webpack/webpack');
 await new Promise<void>((done,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:resolve(directory,'entry.js'),output:{path:directory,filename:'bundle.js',publicPath:'/__navigation_assets/'},resolve:{modules:[resolve('node_modules')],alias:{'next/link':resolve(directory,'next-link.js'),'next/navigation':resolve(directory,'next-navigation.js')}},module:{rules:[{test:/\.m?js$/,resolve:{fullySpecified:false}}]}});compiler.run((error:Error|null,stats:{hasErrors():boolean;toString():string})=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):done()));});
 const cssFiles=(await readdir('.next/static/chunks')).filter(file=>file.endsWith('.css')).sort();
 if(!cssFiles.length)throw new Error('Run the production build before navigation browser verification');
 return {script:await readFile(resolve(directory,'bundle.js'),'utf8'),css:(await Promise.all(cssFiles.map(file=>readFile(resolve('.next/static/chunks',file),'utf8')))).join('\n')};
}
