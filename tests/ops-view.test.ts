import test from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {loadOpsViews} from './helpers/ops-view.ts';
test('OPS collection distinguishes authorized content empty denied and unavailable without leaked metadata',async()=>{
 const m=await loadOpsViews();assert.equal(typeof m?.OpsCollection,'function');if(!m)return;
 const data={items:[{id:'ops/id',title:'受限标题 <script>',revision:2,tags:['内部标签']}],total:31,page:1,pages:2};
 const html=renderToStaticMarkup(createElement(m.OpsCollection,{data,state:'ready'}));assert.match(html,/受限标题 &lt;script&gt;/);assert.match(html,/\/help-centre\?article=ops%2Fid/);assert.match(html,/\/help-centre\/ops\?page=2/);assert.match(html,/内部标签/);
 for(const state of ['denied','unavailable'] as const){const closed=renderToStaticMarkup(createElement(m.OpsCollection,{data,state}));assert.doesNotMatch(closed,/受限标题|内部标签|31|article=/);assert.doesNotMatch(closed,/暂时没有已发布的运营资料/);}
 assert.match(renderToStaticMarkup(createElement(m.OpsCollection,{state:'ready',data:{items:[],total:0,page:1,pages:1}})),/暂时没有已发布的运营资料/);
 assert.equal(renderToStaticMarkup(createElement(m.OpsEntryLink,{allowed:false})), '');assert.match(renderToStaticMarkup(createElement(m.OpsEntryLink,{allowed:true})),/OPS Internal/);
});
