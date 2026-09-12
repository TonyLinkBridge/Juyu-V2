import {test,expect} from '@playwright/test';
import {screenInlineStyle} from '../../src/editor/inline';
test('published pasted black/transparent ink follows theme while red stays red',async({page},info)=>{
 await page.setContent('<html data-theme="light"><head><style>:root{--ink:#22242a;background:white} :root[data-theme=dark]{--ink:#eeedf1;background:#222229}body{color:var(--ink);font:20px sans-serif;padding:24px}p{margin:24px 0}</style></head><body><p id="black">修改账户邮箱流程</p><p id="red">无法正常登录</p><p id="yellow">带底色文字</p></body></html>');
 for(const [id,props] of [['black',{textColor:'rgb(0, 0, 0)',backgroundColor:'transparent'}],['red',{textColor:'rgb(255, 0, 0)',backgroundColor:'transparent'}],['yellow',{textColor:'rgb(0, 0, 0)',backgroundColor:'yellow'}]] as const){await page.locator('#'+id).evaluate((e,style)=>{for(const[k,v]of Object.entries(style))if(v!==undefined){if(k.startsWith('--'))(e as HTMLElement).style.setProperty(k,v);else Object.assign((e as HTMLElement).style,{[k]:v});}},screenInlineStyle(props));}
 await expect(page.locator('#black')).toHaveCSS('color','rgb(34, 36, 42)');
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await expect(page.locator('#black')).toHaveCSS('color','rgb(238, 237, 241)');await expect(page.locator('#red')).toHaveCSS('color','rgb(255, 0, 0)');await expect(page.locator('#yellow')).toHaveCSS('color','rgb(0, 0, 0)');
 await page.screenshot({path:`output/verification/theme-transparent-${info.project.name}.png`});
 await page.evaluate(()=>document.documentElement.dataset.theme='light');await expect(page.locator('#black')).toHaveCSS('color','rgb(34, 36, 42)');
});
