'use client';
import type {MediaBlock} from '../../media/model';

type TableBlock=Extract<MediaBlock,{type:'table'}>;
export function TableConfigFields({block,onChange}:{block:TableBlock;onChange:(block:TableBlock)=>void}){
 return <div className="table-config-fields"><label>阅读展示<select value={block.view??'grid'} onChange={event=>onChange({...block,view:event.target.value as 'grid'|'cards'})}><option value="grid">表格</option><option value="cards">卡片</option></select></label><label><input type="checkbox" checked={block.searchable??(block.rows.length>=8&&block.view!=='cards')} onChange={event=>onChange({...block,searchable:event.target.checked})}/>允许读者搜索和筛选</label>{(block.view??'grid')==='grid'&&<><label><input type="checkbox" checked={block.stickyHeader??false} onChange={event=>onChange({...block,stickyHeader:event.target.checked})}/>滚动时固定表头</label><label><input type="checkbox" checked={block.stickyFirstColumn??false} onChange={event=>onChange({...block,stickyFirstColumn:event.target.checked})}/>横向滚动时固定首列</label></>}</div>;
}
