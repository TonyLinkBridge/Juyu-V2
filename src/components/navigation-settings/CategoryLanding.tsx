/* Category and article clicks request current server authorization. */
import type {CategoryPage} from '../../reader/category-page';
export function CategoryLanding({data,failed=false}:{data:CategoryPage|null;failed?:boolean}){
 if(!data)return <section className="category-landing"><h1>{failed?'分类暂时无法加载':'分类暂不可用'}</h1><p role="status">{failed?'请重新加载。若持续失败，请联系管理员。':'该分类目前没有可供你阅读的正式资料。'}</p><a className="secondary-link" href="/help-centre">返回资料库</a></section>;
 const href=(page:number)=>`/help-centre/categories/${data.id}?page=${page}`;
 return <section className="category-landing"><nav aria-label="分类面包屑"><a href="/help-centre">帮助中心</a>{data.ancestors.map(parent=><span key={parent.id}> / <a href={`/help-centre/categories/${parent.id}`}>{parent.title}</a></span>)}<span> / {data.title}</span></nav><p className="reader-eyebrow">资料分类</p><h1>{data.title}</h1><p>共 {data.total} 篇可阅读的已发布资料</p><ul className="category-landing-items">{data.items.map(item=><li key={item.id}><a href={item.href}>{item.title}<span aria-hidden="true">↗</span></a></li>)}</ul>{data.pages>1&&<nav className="category-landing-pages" aria-label="分类分页">{data.page>1&&<a href={href(data.page-1)}>上一页</a>}<span>第 {data.page} / {data.pages} 页</span>{data.page<data.pages&&<a href={href(data.page+1)}>下一页</a>}</nav>}<a className="secondary-link" href="/help-centre">返回资料库</a></section>;
}
