import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import test from 'node:test';

test('one Fumadocs provider supplies footer and account theme controls',async()=>{
 const layout=await readFile('src/app/layout.tsx','utf8');
 assert.match(layout,/RootProvider/);
 assert.match(layout,/fumadocsRootI18n\('zh-CN'\)/);
 assert.doesNotMatch(layout,/THEME_BOOTSTRAP|dangerouslySetInnerHTML/);

 const account=await readFile('src/components/shell/AccountControls.tsx','utf8');
 const footer=await readFile('src/components/gitbook/Footer/Footer.tsx','utf8');
 assert.match(footer,/fumadocs-ui\/layouts\/shared\/slots\/theme-switch/);
 assert.match(footer,/ThemeSwitch/);
 assert.match(account,/fumadocs-ui\/layouts\/shared\/slots\/theme-switch/);
 assert.match(account,/showTheme=\{false\}/);
 assert.doesNotMatch(account,/ThemeToggler/);

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
