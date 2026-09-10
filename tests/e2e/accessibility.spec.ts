import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {test,expect,type Page} from '@playwright/test';
import type {AxeResults} from 'axe-core';
import {workspaceHTML} from '../helpers/workspace-browser';
import {navigationBrowserBundle} from '../helpers/navigation-browser';
import {featureBrowserBundle} from '../helpers/features-browser';
import {editorBrowserBundle,editorFixture} from '../helpers/editor-browser';
import {decisionBrowserBundle,decisionFixture} from '../helpers/decision-browser';
import {defaultFeatureFlags} from '../../src/features/model';
let decision:Awaited<ReturnType<typeof decisionBrowserBundle>>;
let reader:Awaited<ReturnType<typeof navigationBrowserBundle>>;
let features:Awaited<ReturnType<typeof featureBrowserBundle>>;
let editor:Awaited<ReturnType<typeof editorBrowserBundle>>;
test.beforeAll(async()=>{decision=await decisionBrowserBundle();reader=await navigationBrowserBundle();features=await featureBrowserBundle();editor=await editorBrowserBundle();});
function html(bundle:{css:string;script:string},markup:string,data:unknown){return `<!doctype html><html lang="zh-CN"><head><title>JUYU 无障碍本地验收</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.css}</style></head><body>${markup}<script id="data" type="application/json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script><script>${bundle.script.replaceAll('</script','<\\/script')}</script></body></html>`;}
async function mount(page:Page,surface:string){
 if(surface==='login'){await page.goto('/sign-in');return;}
 let body:string;
 if(surface.startsWith('workspace'))body=(await workspaceHTML('http://localhost/admin',{empty:surface==='workspace-empty',failed:surface==='workspace-error'})).replace('<head>','<head><title>JUYU 后台本地验收</title>');
 else if(surface==='decision')body=html(decision,'<main class="editor-main"><h1>内容二审 · 本地样例</h1><div id="review"></div></main>',decisionFixture);
 else if(surface==='editor')body=html(editor,'<main class="editor-main"><h1>编辑文章 · 本地样例</h1><div id="editor"></div></main>',editorFixture);
 else if(surface.startsWith('features'))body=html(features,'<main id="features"></main>',{config:surface==='features-error'?null:{version:0,flags:defaultFeatureFlags}});
 else body=html(reader,'<div id="presentation"></div>',{pages:[{type:'document',id:'a11y',title:'阅读核对 · 本地样例',href:'/help-centre?article=a11y'}],requested:'a11y',article:{id:'a11y',title:'阅读核对 · 本地样例',revision:1,tags:['示例'],body:'# 使用说明\n\n这是本地验收内容。\n\n## 核对步骤\n\n请核对阅读顺序。'},announcement:{id:'a11y',revision:'1',message:'本地测试，非公司资料'}});
 await page.route('**/__accessibility',r=>r.fulfill({contentType:'text/html',body}));await page.goto('/__accessibility');
 await expect(page.getByRole('heading',{level:1})).toBeVisible();if(surface==='workspace-tools')await page.locator('.tasks-tools-disclosure summary').click();if(surface==='editor')await expect(page.locator('.bn-editor')).toBeVisible();
}
for(const surface of ['login','reader','workspace','workspace-tools','workspace-empty','workspace-error','features','features-error','editor','decision'])test(`${surface} has no automated accessibility violations in both themes`,async({page},info)=>{
 test.setTimeout(60000);await mount(page,surface);await page.emulateMedia({reducedMotion:'reduce'});
 await page.addScriptTag({content:await readFile('node_modules/axe-core/axe.min.js','utf8')});
 for(const theme of ['light','dark']){
 await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
 await expect(page.locator('body')).toHaveCSS('color',theme==='light'?'rgb(34, 36, 42)':'rgb(238, 237, 241)');
 const result=await page.evaluate(async()=>await (window as unknown as {axe:{run(options:unknown):Promise<AxeResults>}}).axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
 await mkdir('output/verification/T057',{recursive:true});
 await writeFile(`output/verification/T057/${surface}-${theme}-${info.project.name}.json`,JSON.stringify({surface,theme,project:info.project.name,at:new Date().toISOString(),...result},null,2));
 await page.screenshot({path:`output/verification/T057/${surface}-${theme}-${info.project.name}.png`,fullPage:true});
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/verification/T057/${surface}-${theme}-${info.project.name}-viewport.png`,fullPage:false});
 expect.soft(result.incomplete.filter(v=>v.id==='aria-prohibited-attr')).toEqual([]);
 expect.soft(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
 expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('workspace keeps frequent actions visible and tools keyboard operable at 320 pixels',async({page},info)=>{
 await page.setViewportSize({width:320,height:844});await mount(page,'workspace');
 await expect(page.getByRole('link',{name:'新建文章',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'员工资料库 ↗',exact:true})).toBeVisible();
 const toggle=page.locator('.tasks-tools-disclosure summary');await expect(toggle).toBeVisible();
 await expect(page.getByRole('link',{name:'成员与权限',exact:true})).toHaveCount(0);
 expect((await page.getByLabel('搜索标题').boundingBox())!.y).toBeLessThan(600);
 await toggle.focus();await page.keyboard.press('Enter');await expect(page.getByRole('link',{name:'成员与权限',exact:true})).toBeVisible();
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'回收站',exact:true})).toBeFocused();
 await toggle.focus();await page.keyboard.press('Space');await expect(page.getByRole('link',{name:'成员与权限',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`output/verification/T057/workspace-320-${info.project.name}.png`,fullPage:true});
});
test('actual login skip link and named editor can be reached with the keyboard',async({page})=>{
 await page.goto('/sign-in');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'跳到主要内容'})).toBeFocused();await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/#main-content$/);await page.keyboard.press('Tab');await expect(page.getByRole('radio',{name:'跟随系统',exact:true})).toBeFocused();
 await mount(page,'editor');const body=page.getByRole('textbox',{name:'文章正文',exact:true});await expect(body).toBeVisible();
 await body.focus();await expect(body).toBeFocused();await page.keyboard.press('Tab');expect(await body.evaluate(e=>e===document.activeElement)).toBe(false);
});
