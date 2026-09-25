import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import test from 'node:test';

test('the application uses one official Fumadocs theme provider and switch',async()=>{
 const layout=await readFile('src/app/layout.tsx','utf8');
 assert.match(layout,/RootProvider/);
 assert.match(layout,/fumadocsRootI18n\('zh-CN'\)/);
 assert.doesNotMatch(layout,/THEME_BOOTSTRAP|dangerouslySetInnerHTML/);

 const account=await readFile('src/components/shell/AccountControls.tsx','utf8');
 const footer=await readFile('src/components/gitbook/Footer/Footer.tsx','utf8');
 for(const source of [account,footer]){
  assert.match(source,/fumadocs-ui\/layouts\/shared\/slots\/theme-switch/);
  assert.match(source,/ThemeSwitch/);
  assert.doesNotMatch(source,/ThemeToggler/);
 }

 const globals=await readFile('src/app/globals.css','utf8');
 const shell=await readFile('src/app/product-shell.css','utf8');
 for(const source of [globals,shell]){
  assert.doesNotMatch(source,/\[data-theme(?:=|\])/);
  assert.match(source,/\.dark/);
 }

 for(const obsolete of ['src/reader/theme.ts','src/components/gitbook/ThemeToggler/ThemeToggler.tsx']){
  await assert.rejects(access(obsolete));
 }
});
