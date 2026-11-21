import {test,expect,type Page} from '@playwright/test';
import {workspaceHTML,workspaceRows} from '../helpers/workspace-browser';
import {availabilityBrowserBundle,availabilityFixture as availability} from '../helpers/availability-browser';
import {qaBrowserBundle} from '../helpers/qa-browser';

const row={...workspaceRows[0],id:availability.documentId,kind:'qa' as const,title:availability.title,status:'in_review' as const,sequence:5,submitter:'测试作者',reviewer:'测试二审人',canReview:true};
function workspaceRoute(page:Page,rows=workspaceRows){
 return page.route(url=>url.pathname==='/admin',async r=>r.fulfill({contentType:'text/html',body:await workspaceHTML(r.request().url(),{rows})}));
}
function html(bundle:{css:string;script:string},root:string,data:unknown){
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>${bundle.css}</style><div id="${root}"></div><script type="application/json" id="data">${JSON.stringify(data).replaceAll('<','\\u003c')}</script><script>${bundle.script.replaceAll('</script','<\\/script')}</script></html>`;
}
test('entering returned scope drops the incompatible published filter',async({page})=>{
 const returned={...row,status:'changes_requested' as const};
 await workspaceRoute(page,[returned]);
 await page.goto('/admin?kind=qa&status=published&view=list');
 await page.getByRole('link',{name:'退回给我的',exact:true}).click();
 const current=new URL(page.url()).searchParams;
 expect(current.get('scope')).toBe('returned');
 expect(current.get('status')).toBe('all');
 await expect(page.getByRole('link',{name:row.title,exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'需要修改 1',exact:true})).toBeVisible();
});
test('review title and action take the same route in board and list',async({page},info)=>{
 test.skip(info.project.name==='mobile','Phones show the list layout.');
 await workspaceRoute(page,[row]);
 await page.goto('/admin?scope=review&kind=qa&view=board');
 const board=page.getByRole('region',{name:'六状态内容看板'});
 await expect(board.getByRole('link',{name:row.title,exact:true})).toHaveAttribute('href','/admin/review?article='+row.id);
 await expect(board.getByRole('link',{name:'处理审核'})).toHaveAttribute('href','/admin/review?article='+row.id);
 await page.getByRole('link',{name:'列表',exact:true}).click();
 await expect(page.getByRole('link',{name:'处理审核',exact:true})).toHaveAttribute('href','/admin/review?article='+row.id);
});
test('archiving an in-review document refreshes the other tab',async({page,context})=>{
 const bundle=await availabilityBrowserBundle(),queue=await context.newPage();
 let archived=false,reads=0;
 await workspaceRoute(queue,[row]);
 await queue.route('**/api/admin/workspace?*',r=>{
  reads++;
  return r.fulfill({json:{query:{q:'',scope:'review',kind:'qa',status:'all',view:'list',page:1},items:archived?[]:[row],counts:{draft:0,in_review:archived?0:1,changes_requested:0,approved:0,queued:0,published:0},total:archived?0:1,selectors:[],page:1,pages:1}});
 });
 await queue.goto('/admin?scope=review&kind=qa&view=list');
 await expect(queue.getByRole('link',{name:'等待审核 1',exact:true})).toBeVisible();
 await page.route('**/__audit_archive',r=>r.fulfill({contentType:'text/html',body:html(bundle,'root',availability)}));
 await page.route('**/api/admin/availability/*',r=>{
  if(r.request().method()==='POST'){archived=true;return r.fulfill({json:{documentId:row.id,sequence:6,revision:2,action:'archive',lifecycle:'archived',status:'draft',publishedRevision:null}});}
  return r.fulfill({json:{...availability,sequence:6,status:'draft',lifecycle:'archived',publishedRevision:null,canArchive:false,canUnpublish:false,canUnarchive:true}});
 });
 await page.goto('/__audit_archive');
 await page.getByRole('button',{name:'归档文章',exact:true}).click();
 await page.getByRole('button',{name:'确认归档',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('已归档');
 await expect(page.getByText('当前正式版：无',{exact:true})).toBeVisible();
 await expect(queue.getByRole('link',{name:'等待审核 0',exact:true})).toBeVisible({timeout:2500});
 expect(reads).toBeGreaterThan(0);
 await queue.close();
});
test('Q&A category switching clears an earlier topic and shows matching answers',async({page})=>{
 const bundle=await qaBrowserBundle();
 const rows=[{id:'credit',category:'财务',title:'信用额度怎么用？',revision:1,tags:['信用额度']},{id:'login',category:'账户',title:'如何更换登录邮箱？',revision:1,tags:['安全']}];
 await page.route('**/help-centre/qa?*',r=>{
  const query=new URL(r.request().url()).searchParams,category=query.get('category')??undefined,topic=query.get('topic')??undefined;
  const items=rows.filter(row=>(!category||category===row.category)&&(!topic||row.tags.includes(topic)));
  return r.fulfill({contentType:'text/html',body:html(bundle,'presentation',{qaView:{viewerId:'fixture',state:'ready',data:{q:'',category,topic,categories:['财务','账户'],topics:['信用额度','安全'],items,total:items.length,page:1,pages:1,canEdit:false}}})});
 });
 await page.goto('/help-centre/qa?category='+encodeURIComponent('财务')+'&topic='+encodeURIComponent('信用额度'));
 await page.getByRole('navigation',{name:'问答分类'}).getByRole('link',{name:'账户',exact:true}).click();
 expect(new URL(page.url()).searchParams.get('topic')).toBeNull();
 await expect(page.getByRole('button',{name:'如何更换登录邮箱？',exact:true})).toBeVisible();
});
