import {createElement} from 'react';
import {BookOpen,ChatCircle,LinkSimple,ShieldCheck} from '@phosphor-icons/react/dist/ssr';
import type {LayoutTab} from 'fumadocs-ui/layouts/shared';
import type {MenuItem} from '../navigation-settings/model';

const contentPaths=['/help-centre','/help-centre/ops','/help-centre/reference','/help-centre/qa'] as const;
type ContentPath=typeof contentPaths[number];

const copy={
 'zh-CN':{
  '/help-centre':{title:'知识文章',description:'团队正式知识'},
  '/help-centre/ops':{title:'OPS Internal',description:'运营流程与升级处理'},
  '/help-centre/reference':{title:'Reference 速查',description:'业务规则速查'},
  '/help-centre/qa':{title:'Q&A 问答',description:'已审核标准答案'},
 },
 en:{
  '/help-centre':{title:'Articles',description:'Approved team knowledge'},
  '/help-centre/ops':{title:'OPS Internal',description:'Operations and escalation guidance'},
  '/help-centre/reference':{title:'Reference',description:'Business rules and quick reference'},
  '/help-centre/qa':{title:'Q&A',description:'Reviewed standard answers'},
 },
} as const;

const icons={
 '/help-centre':BookOpen,
 '/help-centre/ops':ShieldCheck,
 '/help-centre/reference':LinkSimple,
 '/help-centre/qa':ChatCircle,
} as const;

export function fumadocsContentTabs(
 items:MenuItem[],
 locale:'zh-CN'|'en',
 active?:{path:ContentPath;pathname:string},
):LayoutTab[]{
 const allowed=new Set(items.map(item=>item.href));
 return contentPaths.filter(path=>allowed.has(path)).map(path=>{
  const label=copy[locale][path];
  const suffix=locale==='en'?'?lang=en':'';
  return {
   title:label.title,
   description:label.description,
   url:`${path}${suffix}`,
   icon:createElement(icons[path],{size:20,weight:'regular','aria-hidden':true}),
   ...(active?.path===path?{urls:new Set([path,active.pathname])}:{}),
  } satisfies LayoutTab;
 });
}
