'use client';
import {MultiSelect} from '../ui/arc/multi-select/multi-select';
import {ArcScope} from '../ui/arc/ArcScope';
import {categoryState,visibleCategoryOptions} from '../../categories/editor';
import type {CategoryDefinition} from '../../categories/model';
const labels={staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'};
export function ArticleCategories({options=[],ids=[],locale='zh-CN'}:{options?:CategoryDefinition[];ids?:string[];locale?:'zh-CN'|'en'}){
 const english=locale==='en';return <section className="article-categories" aria-label={english?'Article categories':'文章目录分类'}><h3>{english?'Categories':'目录分类'}</h3>{ids.length?<ul>{ids.map(id=>{const state=categoryState(options,id,locale);return <li key={id}>{state.path} · {state.enabled?(english?{staff:'All staff',ops:'Ops and Admin',admin:'Admin only'}[state.audience]:labels[state.audience]):(english?'Inactive or unavailable':'已停用或暂不可用')}</li>;})}</ul>:<p>{english?'Uncategorized':'未分类'}</p>}</section>;
}
export function CategoryInputs({options,ids,disabled,onChange,locale='zh-CN'}:{options:CategoryDefinition[];ids:string[];disabled:boolean;onChange:(ids:string[])=>void;locale?:'zh-CN'|'en'}){
 const english=locale==='en',visible=visibleCategoryOptions(options,ids,locale);return <fieldset className="article-categories" disabled={disabled}><legend>{english?'Categories':'目录分类'}</legend><p>{english?'Choose up to 20 categories. Changes take effect after review and publication.':'选择文章所属的目录，最多 20 项。修改会在审核发布后生效。'}</p>
 {visible.length===0?<div className="editor-category-empty"><strong>{english?'No categories yet':'还没有可选分类'}</strong><p>{english?'Categories help employees find articles. You can write the content now and choose categories later.':'分类帮助员工从目录找到文章。你可以先写正文，稍后再选择。'}</p><a href="/admin/settings/categories" target="_blank" rel="noopener noreferrer">{english?'Open category settings ↗':'打开分类设置 ↗'}</a><small>{english?'Opens in a new tab so your draft stays here.':'在新页面打开，保留当前草稿。'}</small></div>:<ArcScope><MultiSelect clearLabel={english?'Clear all selections':'清除所有选择'} label={english?'Assigned categories':'选择目录分类'} placeholder={english?'Choose categories':'选择文章所属分类'} value={ids} disabled={disabled} maxVisible={2} options={visible.map(c=>{const state=categoryState(options,c.id,locale),checked=ids.includes(c.id);return {value:c.id,label:`${state.path} · ${state.enabled?(english?{staff:'All staff',ops:'Ops and Admin',admin:'Admin only'}[state.audience]:labels[state.audience]):(english?'Inactive assignment':'已停用的旧分类')}`,disabled:!checked&&ids.length>=20};})} onValueChange={next=>{if(next.length<=20)onChange([...next].sort());}}/></ArcScope>}
 <small>{english?'Employees need access to both the article and its categories.':'员工需要同时符合文章及所选分类的阅读权限。'}</small></fieldset>;
}
