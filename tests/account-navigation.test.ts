import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const readerEntries=[
 'src/app/help-centre/articles/[articleId]/page.tsx',
 'src/app/help-centre/changelog/page.tsx',
 'src/app/help-centre/favorites/page.tsx',
 'src/app/help-centre/ops/[articleId]/page.tsx',
 'src/app/help-centre/ops/page.tsx',
 'src/app/help-centre/qa/page.tsx',
 'src/app/help-centre/recent/page.tsx',
 'src/app/help-centre/reference/page.tsx',
 'src/server/forms/entry.ts',
];

test('the shared Help Centre layout does not duplicate page authorization or database reads',async()=>{
 const source=await readFile(new URL('../src/app/help-centre/layout.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/currentAccountAccess|readReaderPresentation|applicationAuthorization/);
 assert.match(source,/ReaderFrame/);
});

test('established account navigation does not repeat company enrollment or member binding',async()=>{
 for(const path of readerEntries){
  const source=await readFile(new URL(`../${path}`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/employeeCompanyAccess|applicationEnrollment|bindCurrentMember/,path);
  assert.match(source,/currentAccountAccess|requireReaderAccount/,path);
 }
});

test('admin entry uses the stored account role instead of repeating company verification',async()=>{
 const source=await readFile(new URL('../src/server/authentication/admin-entry.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/employeeCompanyAccess|adminForCompany/);
 assert.match(source,/currentAccountAccess|adminForAccount/);
});
