import {encodeEditorBody} from '../../src/editor/document.ts';
import {normalizeBlocks,type MediaBlock} from '../../src/media/model.ts';
export function largeBody(count=300,characters=1000){return encodeEditorBody(Array.from({length:count},(_,i)=>({id:`scale-${i}`,type:i%30===0?'heading':'paragraph',props:i%30===0?{level:2}:{},content:[{type:'text',text:i%30===0?`第${i+1}节 操作核对`:`第${i+1}段 `+'核对域名续费资料与运营规则。'.repeat(Math.ceil(characters/14)).slice(0,characters)+` 结束标记${i+1}`,styles:{}}],children:[]})));}
export const longTable:Extract<MediaBlock,{type:'table'}>={id:'scale-table',type:'table',headers:Array.from({length:8},(_,i)=>`栏目${i+1}`),rows:Array.from({length:200},(_,i)=>Array.from({length:8},(_,j)=>`${i===199?'最后行针尖':'本地样例'}-${i+1}-${j+1} 注册、续费、转入核对`))};
normalizeBlocks([longTable]);
