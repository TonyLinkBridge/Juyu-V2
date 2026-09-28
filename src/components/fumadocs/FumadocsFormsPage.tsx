import {FumadocsDocsLayout as DocsLayout} from './FumadocsDocsLayout';
import {DocsBody,DocsDescription,DocsPage,DocsTitle} from 'fumadocs-ui/layouts/docs/page';
import type {FormDefinition} from '../../forms/model';
import type {MenuItem} from '../../navigation-settings/model';
import {fumadocsRootTree} from '../../fumadocs/tree';
import {FormCollection} from '../forms/FormViews';
import {FumadocsAccountFooter} from './FumadocsAccountFooter';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';
import '../../app/fumadocs-reader.css';
import '../../app/forms.css';

interface FumadocsFormsPageProps {
 data?:FormDefinition[];
 state:'ready'|'disabled'|'unavailable';
 menu?:MenuItem[];
 search?:boolean;
}

function formsTree(data:FormDefinition[]|undefined) {
 const name='内部表单';
 const forms=data??[];
 return fumadocsRootTree('forms',name,forms.map(form=>({type:'page' as const,$id:form.id,name:form.title,url:`/help-centre/forms/${form.id}`})),forms.map(form=>form.id));
}

function formsCopy(state:FumadocsFormsPageProps['state']){
 if(state==='disabled')return {title:'内部表单尚未开放',description:'此功能目前已关闭；如需使用，请联系管理员。'};
 if(state==='unavailable')return {title:'内部表单暂时无法读取',description:'请重新读取；如果持续失败，请联系管理员。'};
 return {title:'内部表单',description:'选择表单，填写后提交给管理员处理。'};
}

export function FumadocsFormsContent({data,state,search=false}:FumadocsFormsPageProps){
 const copy=formsCopy(state);
 return <FumadocsPublicationI18n locale="zh-CN"><DocsLayout
  tree={formsTree(state==='ready'?data:undefined)}
  nav={{title:'JUYU Help Centre',url:'/help-centre'}}
  sidebar={{prefetch:false,footer:<FumadocsAccountFooter locale="zh-CN"/>}}
  searchToggle={{enabled:search}}
 >
  <DocsPage data-fumadocs-forms-page="" toc={[]} breadcrumb={{enabled:false}} tableOfContent={{enabled:false}} tableOfContentPopover={{enabled:false}} footer={{enabled:false}}>
   <DocsTitle>{copy.title}</DocsTitle>
   <DocsDescription>{copy.description}</DocsDescription>
   <DocsBody><div className="not-prose fumadocs-forms-content"><FormCollection data={data} state={state} withinDocsPage/></div></DocsBody>
  </DocsPage>
 </DocsLayout></FumadocsPublicationI18n>;
}

export function FumadocsFormsPage(props:FumadocsFormsPageProps){
 return <FumadocsSearchProvider locale="zh-CN"><FumadocsFormsContent {...props}/></FumadocsSearchProvider>;
}
