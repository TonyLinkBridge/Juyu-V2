import {test,expect} from '@playwright/test';
import {workspaceHTML,workspaceRows} from '../helpers/workspace-browser';
import type {WorkspaceItem} from '../../src/workspace/model';

const rows:WorkspaceItem[]=(['article','ops','reference','qa'] as const).flatMap((kind,index)=>['in_review','changes_requested','approved','queued','draft','published'].map((status,i)=>({...workspaceRows[0],id:`catalog-${kind}-${i}`,kind,status:status as WorkspaceItem['status'],title:`${kind} ${status} 很长的测试标题用于核对完整内容不会被截掉`,editor:'编辑账号.long@example.test',submitter:'submitter.long@example.test',reviewer:'reviewer.long@example.test',sequence:9,revision:3,publishedRevision:i===4?2:null,publicationNumber:i===4?1:null,canReview:index===0,canWithdrawSubmission:true,categoryPaths:['主要分类 / 一级分类 / 子分类','另一个分类','第三分类'],qaCategory:'Whois 隐私保护',qaPosition:5})));

test('catalog preserves all four kinds, exact workflow destinations, categories and role-gated batch actions',async({page})=>{
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),{rows,canBulkWithdraw:true})}));
 await page.goto('/admin?kind=all&view=cards');
 const cards=page.getByRole('region',{name:'资料卡片'});
 await expect(cards.locator('article')).toHaveCount(24);
 await expect(cards.getByRole('link',{name:'立即发布',exact:true})).toHaveCount(8);
 await expect(cards.getByRole('link',{name:'处理审核',exact:true})).toHaveAttribute('href','/admin/review?article=catalog-article-0');
 await expect(cards.getByRole('link',{name:'立即发布',exact:true}).first()).toHaveAttribute('href','/admin/review/publish?article=catalog-article-2&intent=publish_now');
 await expect(cards.getByRole('link',{name:'查看退回原因',exact:true})).toHaveCount(4);
 await expect(cards.getByRole('link',{name:'撤回送审',exact:true})).toHaveCount(4);
 await expect(cards.getByRole('button',{name:'放弃本次修订',exact:true})).toHaveCount(4);
 await expect(cards.getByText('分类：Whois 隐私保护 · 排序：5（数字越小越靠前）')).toHaveCount(6);
 await page.getByLabel('全选本页等待审核资料',{exact:true}).check();
 await page.getByRole('button',{name:'批量撤回送审',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('撤回这 4 份资料');
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await page.getByLabel('全选本页等待审核资料',{exact:true}).uncheck();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:'列表',exact:true}).click();
 await expect(page.getByRole('table')).toBeVisible();
 await page.getByRole('link',{name:'卡片',exact:true}).click();
 await expect(cards).toBeVisible();
});

test('catalog filters use server navigation, preserve cards, and ordinary admins have no bulk controls',async({page},info)=>{
 await page.route(url=>url.pathname==='/admin',async route=>route.fulfill({contentType:'text/html',body:await workspaceHTML(route.request().url(),{rows})}));
 await page.goto('/admin?kind=qa&view=cards');
 await expect(page.getByRole('button',{name:'批量撤回送审',exact:true})).toHaveCount(0);
 await expect(page.getByRole('checkbox')).toHaveCount(0);
 await page.getByLabel('搜索问题').fill('approved');
 await page.getByRole('button',{name:'应用筛选',exact:true}).click();
 await expect(page.getByRole('region',{name:'资料卡片'}).locator('article')).toHaveCount(1);
 expect(new URL(page.url()).searchParams.get('view')).toBe('cards');
 await page.getByRole('button',{name:'添加筛选',exact:true}).click();

 await page.getByRole('menuitemradio',{name:'已经发布',exact:true}).click();
 await expect(page.getByRole('heading',{name:'没有符合条件的内容'})).toBeVisible();
 expect(new URL(page.url()).searchParams.get('view')).toBe('cards');
 await page.getByRole('button',{name:'移除 内容状态: 已经发布',exact:true}).click();
 await expect(page.getByRole('region',{name:'资料卡片'}).locator('article')).toHaveCount(1);
 await page.getByRole('button',{name:'清除全部',exact:true}).click();
 await expect(page.getByRole('region',{name:'资料卡片'}).locator('article')).toHaveCount(6);
 await expect(page.getByLabel('资料类型')).toBeVisible();
 if(info.project.name==='mobile')await expect(page.getByRole('link',{name:'看板',exact:true})).not.toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
