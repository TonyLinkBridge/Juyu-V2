import {requireFormReaderEntry} from '../../../../server/forms/entry';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {FumadocsDirectoryState} from '../../../../components/fumadocs/FumadocsDirectoryState';
import {redirect} from 'next/navigation';
import {categoryPage} from '../../../../reader/category-page';
import {formPage} from '../../../../server/forms/http';
import type {NavigationNode} from '../../../../reader/tree';
import type {MenuItem} from '../../../../navigation-settings/model';
export const dynamic='force-dynamic';
export default async function CategoryPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireFormReaderEntry();const {id}=await params;let data=null,failed=false,pages:NavigationNode[]=[],menu:MenuItem[]=[],features={search:false};
 try{
  const query=await searchParams,url=new URL('http://local/');
  for(const [key,value] of Object.entries(query)){if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}
  const authorization=await applicationAuthorization();
  [pages,menu,features]=await Promise.all([authorization.categoryNavigationTree(),authorization.readerMenu(),authorization.features()]);
  data=categoryPage(pages,id,formPage(url));
 }
 catch(e){failed=!(e instanceof Error&&['INVALID_INPUT','FORBIDDEN','NOT_FOUND'].includes(e.message.split(':')[0]));}
 // Redirect outside the catch: Next redirects throw to finish the response.
 if(data?.items[0])redirect(data.items[0].href);
 return <FumadocsDirectoryState
  pages={pages}
  menu={menu}
  features={features}
  failed={failed}
  title={failed?'分类暂时无法加载':'分类暂不可用'}
  description={failed?'请重新加载。若持续失败，请联系管理员。':'该分类目前没有可供你阅读的正式资料。'}
  retryHref={`/help-centre/categories/${encodeURIComponent(id)}`}
 />;
}
