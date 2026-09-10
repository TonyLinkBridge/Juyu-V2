import {categoryState} from '../../categories/editor';
import type {CategoryDefinition} from '../../categories/model';
const labels={staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'};
export function ArticleCategories({options=[],ids=[]}:{options?:CategoryDefinition[];ids?:string[]}){
 return <section className="article-categories" aria-label="文章目录分类"><h3>目录分类</h3>{ids.length?<ul>{ids.map(id=>{const state=categoryState(options,id);return <li key={id}>{state.path} · {state.enabled?labels[state.audience]:'已停用或暂不可用'}</li>;})}</ul>:<p>未分类</p>}</section>;
}
export function CategoryInputs({options,ids,disabled,onChange}:{options:CategoryDefinition[];ids:string[];disabled:boolean;onChange:(ids:string[])=>void}){
 return <fieldset className="article-categories" disabled={disabled}><legend>目录分类</legend><p>可选最多 20 项。分类归属随本次草稿审核发布；同时受文章本身和所有所选分类的阅读权限限制。</p>
 {options.length===0?<p>尚无可选分类，请先在后台的分类设置中添加。</p>:<div className="article-category-options">{[...options].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)).map(c=>{const state=categoryState(options,c.id),checked=ids.includes(c.id);return <label key={c.id}><input type="checkbox" checked={checked} disabled={!checked&&(!state.enabled||ids.length>=20)} onChange={e=>onChange(e.target.checked?[...ids,c.id].sort():ids.filter(id=>id!==c.id))}/><span>{state.path}<small>{state.enabled?labels[state.audience]:'已停用或暂不可用'}</small></span></label>;})}</div>}
 <small>停用分类中的原有归属会保留；可以取消选择。分类改名不会改变归属。</small></fieldset>;
}
