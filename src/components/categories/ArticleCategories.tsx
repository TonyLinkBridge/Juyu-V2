import {categoryState} from '../../categories/editor';
import type {CategoryDefinition} from '../../categories/model';
const labels={staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'};
export function ArticleCategories({options=[],ids=[]}:{options?:CategoryDefinition[];ids?:string[]}){
 return <section className="article-categories" aria-label="文章目录分类"><h3>目录分类</h3>{ids.length?<ul>{ids.map(id=>{const state=categoryState(options,id);return <li key={id}>{state.path} · {state.enabled?labels[state.audience]:'已停用或暂不可用'}</li>;})}</ul>:<p>未分类</p>}</section>;
}
export function CategoryInputs({options,ids,disabled,onChange}:{options:CategoryDefinition[];ids:string[];disabled:boolean;onChange:(ids:string[])=>void}){
 return <fieldset className="article-categories" disabled={disabled}><legend>目录分类</legend><p>选择文章所属的目录，最多 20 项。修改会在审核发布后生效。</p>
 {options.length===0?<div className="editor-category-empty"><strong>还没有可选分类</strong><p>分类帮助员工从目录找到文章。你可以先写正文，稍后再选择。</p><a href="/admin/settings/categories" target="_blank" rel="noopener noreferrer">打开分类设置 ↗</a><small>在新页面打开，保留当前草稿。</small></div>:<div className="article-category-options">{[...options].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)).map(c=>{const state=categoryState(options,c.id),checked=ids.includes(c.id);return <label key={c.id}><input type="checkbox" checked={checked} disabled={!checked&&(!state.enabled||ids.length>=20)} onChange={e=>onChange(e.target.checked?[...ids,c.id].sort():ids.filter(id=>id!==c.id))}/><span>{state.path}<small>{state.enabled?labels[state.audience]:'已停用或暂不可用'}</small></span></label>;})}</div>}
 <small>员工需要同时符合文章及所选分类的阅读权限。</small></fieldset>;
}
