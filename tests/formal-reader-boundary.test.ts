import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import test from 'node:test';

test('the formal Help Centre shell does not import the legacy article reader',async()=>{
 const route=await readFile('src/app/help-centre/page.tsx','utf8');
 assert.match(route,/FumadocsDirectoryState/);
 assert.doesNotMatch(route,/ReaderDirectoryState/);
 assert.doesNotMatch(route,/ReaderNavigation/);
 const directory=await readFile('src/components/fumadocs/FumadocsDirectoryState.tsx','utf8');
 for(const official of ['DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(directory,new RegExp(official));
 for(const legacy of ['EntryShell','TableOfContents','PageBody','PageAside','pageNavigation','parseReaderBody'])assert.doesNotMatch(directory,new RegExp(legacy));
 const frame=await readFile('src/components/shell/ReaderFrame.tsx','utf8');
 assert.match(frame,/fumadocsDirectory/);
 assert.match(frame,/help-centre\/categories/);
 assert.match(frame,/help-centre\/library/);
 const category=await readFile('src/app/help-centre/categories/[id]/page.tsx','utf8');
 assert.match(category,/FumadocsDirectoryState/);
 assert.doesNotMatch(category,/CategoryLanding|EntryShell/);
 const search=await readFile('src/components/fumadocs/FumadocsSearchPage.tsx','utf8');
 for(const official of ['DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(search,new RegExp(official));
 assert.match(search,/SearchResultsBody/);
 for(const legacy of ['EntryShell','ReaderMenu','ReaderQuickLinks','HeaderSearch'])assert.doesNotMatch(search,new RegExp(legacy));
 assert.match(route,/FumadocsSearchPage/);
 const home=await readFile('src/components/fumadocs/FumadocsKnowledgeHome.tsx','utf8');
 for(const official of ['FumadocsSearchProvider','HomeLayout'])assert.match(home,new RegExp(official));
 assert.match(home,/KnowledgeHome/);
 for(const legacy of ['EntryShell','ReaderQuickLinks','HeaderSearch'])assert.doesNotMatch(home,new RegExp(legacy));
 assert.match(route,/FumadocsKnowledgeHome/);
 assert.doesNotMatch(route,/EntryShell/);
 assert.match(frame,/path==='\/help-centre'/);

 const knowledgeHome=await readFile('src/components/home/KnowledgeHome.tsx','utf8');
 assert.match(knowledgeHome,/FullSearchTrigger/);
 assert.doesNotMatch(knowledgeHome,/gitbook\/Search\/SearchInput|<SearchInput/);
 assert.match(knowledgeHome,/knowledge-home--editorial/);
 assert.match(knowledgeHome,/home-section-tabs/);
 assert.match(knowledgeHome,/home-featured/);
 assert.match(knowledgeHome,/home-document-number/);
 assert.match(knowledgeHome,/home-side/);
 assert.doesNotMatch(knowledgeHome,/home-entry-icon/);
 const searchProvider=await readFile('src/components/fumadocs/FumadocsSearchProvider.tsx','utf8');
 assert.match(searchProvider,/fumadocsSearchOptions\(locale\)/);
 assert.match(searchProvider,/fumadocsRootI18n\(locale\)/);
 assert.match(searchProvider,/SearchDialog:FumadocsScopedSearchDialog/);
 assert.match(home,/juyu-home-brand/);
 assert.match(home,/NewAnnouncements silentFailure/);
 assert.match(home,/searchToggle=\{\{enabled:false\}\}/);
 assert.doesNotMatch(home,/themeSwitch=\{\{enabled:false\}\}/);
 assert.match(searchProvider,/theme=\{\{enabled:false\}\}/);

 const homeStyles=await readFile('src/app/product-shell.css','utf8');
 assert.match(homeStyles,/--juyu-home-accent:#b3131b/);
 assert.match(homeStyles,/home-hero h1 span\{color:var\(--juyu-home-accent\)\}/);

 const opsRoute=await readFile('src/app/help-centre/ops/page.tsx','utf8');
 const opsPage=await readFile('src/components/fumadocs/FumadocsOpsPage.tsx','utf8');
 assert.match(opsRoute,/FumadocsOpsPage/);
 assert.doesNotMatch(opsRoute,/EntryShell|ReaderMenu|SearchInput|FeatureSearch/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(opsPage,new RegExp(official));
 assert.match(opsPage,/OpsCollection/);
 assert.doesNotMatch(opsPage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 assert.match(frame,/help-centre\/ops/);

 const referenceRoute=await readFile('src/app/help-centre/reference/page.tsx','utf8');
 const referencePage=await readFile('src/components/fumadocs/FumadocsReferencePage.tsx','utf8');
 assert.match(referenceRoute,/FumadocsReferencePage/);
 assert.doesNotMatch(referenceRoute,/EntryShell|ReaderMenu|SearchInput|FeatureSearch/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(referencePage,new RegExp(official));
 assert.match(referencePage,/ReferenceView/);
 assert.doesNotMatch(referencePage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 assert.match(frame,/help-centre\/reference/);

 const qaRoute=await readFile('src/app/help-centre/qa/page.tsx','utf8');
 const qaPage=await readFile('src/components/fumadocs/FumadocsQaPage.tsx','utf8');
 assert.match(qaRoute,/FumadocsQaPage/);
 assert.doesNotMatch(qaRoute,/EntryShell|ReaderMenu|SearchInput|FeatureSearch/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(qaPage,new RegExp(official));
 assert.match(qaPage,/QaView/);
 assert.doesNotMatch(qaPage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 assert.match(frame,/help-centre\/qa/);

 const favoritesRoute=await readFile('src/app/help-centre/favorites/page.tsx','utf8');
 const favoritesPage=await readFile('src/components/fumadocs/FumadocsFavoritesPage.tsx','utf8');
 assert.match(favoritesRoute,/FumadocsFavoritesPage/);
 assert.doesNotMatch(favoritesRoute,/EntryShell|ReaderMenu|SearchInput|FeatureSearch|FeaturePage/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(favoritesPage,new RegExp(official));
 assert.match(favoritesPage,/FavoritesView/);
 assert.doesNotMatch(favoritesPage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 const favoritesView=await readFile('src/components/favorites/FavoritesView.tsx','utf8');
 assert.match(favoritesView,/fumadocs-ui\/components\/card/);
 assert.match(favoritesView,/buttonVariants/);
 assert.doesNotMatch(favoritesView,/SearchResultItem/);
 assert.match(frame,/help-centre\/favorites/);

 const recentRoute=await readFile('src/app/help-centre/recent/page.tsx','utf8');
 const recentPage=await readFile('src/components/fumadocs/FumadocsRecentPage.tsx','utf8');
 assert.match(recentRoute,/FumadocsRecentPage/);
 assert.doesNotMatch(recentRoute,/EntryShell|ReaderMenu|SearchInput|FeatureSearch|FeaturePage/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(recentPage,new RegExp(official));
 assert.match(recentPage,/RecentView/);
 assert.doesNotMatch(recentPage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 const recentView=await readFile('src/components/recent/RecentView.tsx','utf8');
 assert.match(recentView,/fumadocs-ui\/components\/card/);
 assert.match(recentView,/buttonVariants/);
 assert.doesNotMatch(recentView,/SearchResultItem/);
 assert.match(frame,/help-centre\/recent/);

 const formsRoute=await readFile('src/app/help-centre/forms/page.tsx','utf8');
 const formsPage=await readFile('src/components/fumadocs/FumadocsFormsPage.tsx','utf8');
 assert.match(formsRoute,/FumadocsFormsPage/);
 assert.doesNotMatch(formsRoute,/EntryShell|ReaderMenu|FeaturePage/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(formsPage,new RegExp(official));
 assert.match(formsPage,/FormCollection/);
 assert.doesNotMatch(formsPage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 const formViews=await readFile('src/components/forms/FormViews.tsx','utf8');
 assert.match(formViews,/fumadocs-ui\/components\/card/);
 assert.match(formViews,/buttonVariants/);
 assert.match(frame,/help-centre\/forms/);

 const formFillRoute=await readFile('src/app/help-centre/forms/[id]/page.tsx','utf8');
 const formFillPage=await readFile('src/components/fumadocs/FumadocsFormFillPage.tsx','utf8');
 assert.match(formFillRoute,/FumadocsFormFillPage/);
 assert.doesNotMatch(formFillRoute,/EntryShell|ReaderMenu|FeaturePage/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription'])assert.match(formFillPage,new RegExp(official));
 assert.match(formFillPage,/FormFill/);
 assert.doesNotMatch(formFillPage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 assert.match(frame,/startsWith\('\/help-centre\/forms\/'\)/);

 const changelogRoute=await readFile('src/app/help-centre/changelog/page.tsx','utf8');
 const changelogPage=await readFile('src/components/fumadocs/FumadocsChangelogPage.tsx','utf8');
 assert.match(changelogRoute,/FumadocsChangelogPage/);
 assert.doesNotMatch(changelogRoute,/EntryShell|ReaderMenu|SearchInput/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription','Cards','Card','buttonVariants'])assert.match(changelogPage,new RegExp(official));
 assert.doesNotMatch(changelogPage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 assert.match(frame,/help-centre\/changelog/);

 const pdfRoute=await readFile('src/app/help-centre/pdf/page.tsx','utf8');
 const pdfPage=await readFile('src/components/fumadocs/FumadocsPDFPage.tsx','utf8');
 assert.match(pdfRoute,/FumadocsPDFPage/);
 assert.doesNotMatch(pdfRoute,/EntryShell|ReaderMenu|FeatureSearch|FeaturePage/);
 for(const official of ['FumadocsSearchProvider','DocsLayout','DocsPage','DocsTitle','DocsDescription','buttonVariants'])assert.match(pdfPage,new RegExp(official));
 assert.match(pdfPage,/PDFPage/);
 assert.doesNotMatch(pdfPage,/EntryShell|ReaderMenu|ReaderQuickLinks|HeaderSearch/);
 assert.match(frame,/help-centre\/pdf/);
});

test('the Fumadocs reader imports only the reviewed JUYU business adapters',async()=>{
 const files=[
  await readFile('src/components/fumadocs/FumadocsBlockNoteReaderClient.tsx','utf8'),
  await readFile('src/components/fumadocs/FumadocsPublicationActions.tsx','utf8'),
 ];
 const imports=files.flatMap(source=>[...source.matchAll(/from ['"](\.\.\/reader-support\/[^'"]+)['"]/g)].map(match=>match[1])).sort();
 assert.deepEqual(imports,[
  '../reader-support/ArticleReferenceContext',
  '../reader-support/InlineAnnotation',
  '../reader-support/PageFeedbackForm',
  '../reader-support/ReaderAppearance',
  '../reader-support/StructuredInline',
  '../reader-support/TableExplorer',
 ]);
 assert.equal(files.some(source=>/from ['"]\.\.\/gitbook\//.test(source)),false);
 for(const legacy of ['PageBody','PageAside','PageHeader','TableOfContents','DocumentView','MediaBlocks']){
  assert.equal(imports.some(path=>path.endsWith(`/${legacy}`)),false);
 }
});

test('legacy article design previews redirect to the Fumadocs preview instead of rendering the old shell',async()=>{
 const route=await readFile('src/app/design-preview/[screen]/page.tsx','utf8');
 assert.doesNotMatch(route,/ReaderNavigation/);
 assert.match(route,/screen==='article'\|\|screen==='article-email'/);
 assert.match(route,/redirect\('\/design-preview\/fumadocs-reader'\)/);
 assert.match(route,/screen==='article-plain'/);
 assert.match(route,/redirect\('\/design-preview\/fumadocs-reader\?fixture=plain'\)/);
});

test('the retired article shell is absent from both product source and browser test harnesses',async()=>{
 const retired=[
 'src/components/reader-navigation.tsx',
  'src/components/reader-directory-state.tsx',
  'src/components/navigation-settings/CategoryLanding.tsx',
  ...['PageBody','PageAside','PageHeader','PageCover','PageCoverImage','PageFooterNavigation','PageTags','NewVersionNotice','ArticleMarkdownActions','ScrollSectionsList','ScrollToTopButton'].map(name=>`src/components/gitbook/Reading/${name}.tsx`),
  'src/components/gitbook/Reading/useScrollActiveId.ts',
 ];
 for(const file of retired)await assert.rejects(access(file));
 const helper=await readFile('tests/helpers/navigation-browser.ts','utf8');
 assert.doesNotMatch(helper,/tests\/fixtures\/legacy-reader|ReaderNavigation/);
 for(const file of retired.map(file=>file.replace(/^src\//,'tests/fixtures/legacy-reader/').replace(/\.(tsx|ts)$/,'.$1.fixture')))await assert.rejects(access(file));
});

test('shipped styles do not retain selectors for the retired article shell',async()=>{
 const styles=(await Promise.all([
  'src/app/globals.css',
  'src/app/product-shell.css',
  'src/app/reader-gitbook.css',
 ].map(file=>readFile(file,'utf8')))).join('\n');
 const retiredSelectors=[
  'reader-content','gitbook-page-body','gitbook-page-header','reader-breadcrumbs',
  'reader-title-icon','article-publication-status','reader-version','reader-new-version',
  'gitbook-page-aside','gitbook-outline-list','outline-disclosure','outline-item','outline-link',
  'article-side-actions','reader-markdown-actions','reader-markdown-dialog','reader-page-navigation',
  'reader-navigation-card','reader-navigation-label','reader-navigation-title','reader-navigation-arrow',
  'reader-top-action','reader-back-to-top','reader-page-title',
  'gitbook-toc-frame','reader-blocks','reader-block','reader-heading','reader-pdf-link',
  'reader-changelog',
 ];
 for(const selector of retiredSelectors)assert.doesNotMatch(styles,new RegExp(`\\.${selector}(?![a-z-])`),selector);
});
