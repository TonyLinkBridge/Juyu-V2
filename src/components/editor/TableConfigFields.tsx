'use client';
import type {MediaBlock} from '../../media/model';

type TableBlock=Extract<MediaBlock,{type:'table'}>;
export function TableConfigFields({block,locale='zh-CN',onChange}:{block:TableBlock;locale?:'zh-CN'|'en';onChange:(block:TableBlock)=>void}){
 const t=(zh:string,en:string)=>locale==='en'?en:zh;
 return <div className="table-config-fields"><label>{t('阅读展示','Reader view')}<select value={block.view??'grid'} onChange={event=>onChange({...block,view:event.target.value as 'grid'|'cards'})}><option value="grid">{t('表格','Table')}</option><option value="cards">{t('卡片','Cards')}</option></select></label><label><input type="checkbox" checked={block.searchable??(block.rows.length>=8&&block.view!=='cards')} onChange={event=>onChange({...block,searchable:event.target.checked})}/>{t('允许读者搜索和筛选','Let readers search and filter')}</label>{(block.view??'grid')==='grid'&&<><label><input type="checkbox" checked={block.stickyHeader??false} onChange={event=>onChange({...block,stickyHeader:event.target.checked})}/>{t('滚动时固定表头','Keep column headings visible while scrolling')}</label><label><input type="checkbox" checked={block.stickyFirstColumn??false} onChange={event=>onChange({...block,stickyFirstColumn:event.target.checked})}/>{t('横向滚动时固定首列','Keep the first column visible while scrolling sideways')}</label></>}</div>;
}
