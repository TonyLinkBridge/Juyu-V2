import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const wrappers=[
 'FumadocsKnowledgeHome.tsx','FumadocsDirectoryState.tsx','FumadocsOpsPage.tsx',
 'FumadocsReferencePage.tsx','FumadocsQaPage.tsx','FumadocsFavoritesPage.tsx',
 'FumadocsRecentPage.tsx','FumadocsFormsPage.tsx','FumadocsFormFillPage.tsx',
 'FumadocsChangelogPage.tsx','FumadocsPDFPage.tsx','FumadocsSearchPage.tsx',
];

test('every formal Fumadocs surface uses the same localized scoped search provider',async()=>{
 const provider=await readFile('src/components/fumadocs/FumadocsSearchProvider.tsx','utf8');
 assert.match(provider,/RootProvider/);
 assert.match(provider,/FumadocsScopedSearchDialog/);
 assert.match(provider,/fumadocsSearchOptions\(locale\)/);
 assert.match(provider,/fumadocsRootI18n\(locale\)/);
 for(const file of wrappers){
  const source=await readFile(`src/components/fumadocs/${file}`,'utf8');
  assert.match(source,/FumadocsSearchProvider/);
  assert.doesNotMatch(source,/search=\{\{options:\{api:'\/api\/fumadocs-search'\}\}\}/);
 }
 const publication=await readFile('src/components/fumadocs/FumadocsAuthorizedPublication.tsx','utf8');
 assert.match(publication,/FumadocsSearchProvider locale=\{locale\}/);
 const articleLayout=await readFile('src/app/help-centre/articles/layout.tsx','utf8');
 assert.doesNotMatch(articleLayout,/RootProvider|fumadocs-search/);
 const previewLayout=await readFile('src/app/design-preview/fumadocs-reader/layout.tsx','utf8');
 assert.match(previewLayout,/FumadocsSearchProvider/);
 assert.doesNotMatch(previewLayout,/RootProvider/);
});
