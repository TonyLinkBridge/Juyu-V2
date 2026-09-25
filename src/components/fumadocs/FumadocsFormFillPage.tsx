import type {Root} from 'fumadocs-core/page-tree';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import Link from 'next/link';
import type {FormDefinition} from '../../forms/model';
import type {MenuItem} from '../../navigation-settings/model';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {FormFill} from '../forms/FormViews';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';
import '../../app/fumadocs-reader.css';
import '../../app/forms.css';

interface FumadocsFormFillPageProps {
 data?:FormDefinition;
 state:'ready'|'disabled'|'unavailable';
 menu?:MenuItem[];
 search?:boolean;
}

function formTree(data:FormDefinition|undefined):Root {
 return {name:'内部表单',children:[{
  type:'folder',name:'内部表单',root:true,defaultOpen:true,
  children:data?[{type:'page' as const,$id:data.id,name:data.title,url:`/help-centre/forms/${data.id}`}]:[],
 }]};
}

function formCopy(data:FormDefinition|undefined,state:FumadocsFormFillPageProps['state']){
 if(state==='disabled')return {title:'内部表单尚未开放',description:'此功能目前已关闭；如需使用，请联系管理员。'};
 if(state==='unavailable'||!data)return {title:'表单暂时不可用',description:'表单可能已停用、没有访问权限，或服务暂时无法连接。'};
 return {title:data.title,description:data.description};
}

export function FumadocsFormFillContent({data,state,menu=[],search=false}:FumadocsFormFillPageProps){
 const copy=formCopy(data,state);
 return <FumadocsPublicationI18n locale="zh-CN"><DocsLayout
  tree={formTree(state==='ready'?data:undefined)}
  links={fumadocsMenuLinks(menu,'zh-CN')}
  nav={{title:'JUYU Help Centre',url:'/help-centre'}}
  sidebar={{footer:<FumadocsAccountFooter locale="zh-CN"/>}}
  searchToggle={{enabled:search}}
 >
  <DocsPage data-fumadocs-form-fill-page="" toc={[]} breadcrumb={{includeRoot:{url:'/help-centre/forms'},includePage:state==='ready'}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{copy.title}</DocsTitle>
   <DocsDescription>{copy.description}</DocsDescription>
   <DocsBody><div className="not-prose fumadocs-forms-content">{state==='ready'&&data?<FormFill initial={data} withinDocsPage/>:<div role="status"><p>{copy.description}</p>{state!=='disabled'&&<Link className={buttonVariants({variant:'outline'})} href="/help-centre/forms">返回表单列表</Link>}</div>}</div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsFormFillPage(props:FumadocsFormFillPageProps){
 return <FumadocsSearchProvider locale="zh-CN"><FumadocsFormFillContent {...props}/></FumadocsSearchProvider>;
}
