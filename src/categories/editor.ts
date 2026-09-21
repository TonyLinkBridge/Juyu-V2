import {normalizeCategoryIds,type CategoryDefinition} from './model.ts';
const rank={staff:0,ops:1,admin:2};
export function categoryState(definitions:CategoryDefinition[],id:string,locale:'zh-CN'|'en'='zh-CN'):{path:string;enabled:boolean;audience:CategoryDefinition['audience']} {
 const byId=new Map(definitions.map(c=>[c.id,c]));const visited=new Set<string>(),names:string[]=[];
 let current:string|null=id,enabled=true,audience:CategoryDefinition['audience']='staff';
 while(current!==null){const c=byId.get(current);if(!c||visited.has(current)||visited.size>=10)return {path:names.reverse().join(' / ')||(locale==='en'?'Category unavailable':'分类暂时不可用'),enabled:false,audience:'admin'};
  visited.add(current);names.push(locale==='en'?c.englishName||c.name:c.name);enabled=enabled&&c.enabled;if(rank[c.audience]>rank[audience])audience=c.audience;current=c.parentId;
 }
 return {path:names.reverse().join(' / '),enabled,audience};
}
export function categorySelection(definitions:CategoryDefinition[],ids:unknown,previous:unknown=[]):string[]{
 const selected=normalizeCategoryIds(ids),saved=new Set(normalizeCategoryIds(previous));
 if(selected.some(id=>!definitions.some(c=>c.id===id)||(!categoryState(definitions,id).enabled&&!saved.has(id))))throw new Error('INVALID_INPUT: 请选择可用分类');
 return selected;
}
