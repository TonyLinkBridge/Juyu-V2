import {createElement} from 'react';
import {BookOpen,ChatCircle,LinkSimple,ShieldCheck} from '@phosphor-icons/react/dist/ssr';
import type {LayoutTab} from 'fumadocs-ui/layouts/shared';
import type {MenuItem} from '../navigation-settings/model';

const contentTabs=[
 {path:'/help-centre/library',permissionPath:'/help-centre',icon:BookOpen},
 {path:'/help-centre/ops',permissionPath:'/help-centre/ops',icon:ShieldCheck},
 {path:'/help-centre/reference',permissionPath:'/help-centre/reference',icon:LinkSimple},
 {path:'/help-centre/qa',permissionPath:'/help-centre/qa',icon:ChatCircle},
] as const;
type ContentPath=typeof contentTabs[number]['path'];

const copy={
 'zh-CN':{
  '/help-centre/library':{title:'知识文章',description:'团队正式知识'},
  '/help-centre/ops':{title:'OPS Internal',description:'运营流程与升级处理'},
  '/help-centre/reference':{title:'Reference 速查',description:'业务规则速查'},
  '/help-centre/qa':{title:'Q&A 问答',description:'已审核标准答案'},
 },
 en:{
  '/help-centre/library':{title:'Articles',description:'Approved team knowledge'},
  '/help-centre/ops':{title:'OPS Internal',description:'Operations and escalation guidance'},
  '/help-centre/reference':{title:'Reference',description:'Business rules and quick reference'},
  '/help-centre/qa':{title:'Q&A',description:'Reviewed standard answers'},
 },
} as const;

export function fumadocsContentTabs(
 items:MenuItem[],
 locale:'zh-CN'|'en',
 active?:{path:ContentPath;pathname:string},
 knowledgeEntry?:string,
):LayoutTab[]{
 const allowed=new Set(items.map(item=>item.href));
 return contentTabs.filter(tab=>allowed.has(tab.permissionPath)).map(({path,icon})=>{
  const label=copy[locale][path];
  const suffix=locale==='en'?'?lang=en':'';
  return {
   title:label.title,
   description:label.description,
   url:path==='/help-centre/library'&&knowledgeEntry?knowledgeEntry:`${path}${suffix}`,
   icon:createElement(icon,{size:20,weight:'regular','aria-hidden':true}),
   ...(active?.path===path?{urls:new Set([path,active.pathname])}:{}),
  } satisfies LayoutTab;
 });
}
