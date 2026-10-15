import {requireFormReaderEntry} from '../../../../server/forms/entry';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {FumadocsDirectoryState} from '../../../../components/fumadocs/FumadocsDirectoryState';
import {FumadocsKnowledgeDirectory} from '../../../../components/fumadocs/FumadocsKnowledgeHome';
import {categoryPage} from '../../../../reader/category-page';
import {formPage} from '../../../../server/forms/http';
import type {NavigationNode} from '../../../../reader/tree';
import type {MenuItem} from '../../../../navigation-settings/model';
export const dynamic='force-dynamic';
export default async function CategoryPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireFormReaderEntry();const {id}=await params;let data=null,failed=false,pages:NavigationNode[]=[],menu:MenuItem[]=[],features={search:false},locale:'zh-CN'|'en'='zh-CN';
 try{
  const query=await searchParams,url=new URL('http://local/');
  for(const [key,value] of Object.entries(query)){if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}
  if(query.lang!==undefined&&query.lang!=='en'&&query.lang!=='zh-CN')throw new Error('INVALID_INPUT');
  locale=query.lang==='en'?'en':'zh-CN';
  const authorization=await applicationAuthorization();
  ({pages,menu,features}=await authorization.knowledgeDirectory(locale));
  url.searchParams.delete('lang');
  data=categoryPage(pages,id,formPage(url));
 }
 catch(e){failed=!(e instanceof Error&&['INVALID_INPUT','FORBIDDEN','NOT_FOUND'].includes(e.message.split(':')[0]));}
 if(data)return <FumadocsKnowledgeDirectory pages={pages} menu={menu} search={features.search} locale={locale} category={data}/>;
 return <FumadocsDirectoryState
  pages={pages}
  menu={menu}
  features={features}
  failed={failed}
  locale={locale}
  title={locale==='en'?(failed?'This category is unavailable':'Category not available'):(failed?'分类暂时无法加载':'分类暂不可用')}
  description={locale==='en'?(failed?'Please try again. If the problem continues, contact an admin.':'There are no published articles you can read in this category.'):(failed?'请重新加载。若持续失败，请联系管理员。':'该分类目前没有可供你阅读的正式资料。')}
  retryHref={`/help-centre/categories/${encodeURIComponent(id)}${locale==='en'?'?lang=en':''}`}
 />;
}
