'use client';
import {useContext,useState} from 'react';
import {TableHandlesExtension} from '@blocknote/core/extensions';
import {CellSelection,TableMap} from 'prosemirror-tables';
import {ColorPickerButton,SplitButton,TableCellButton,TableCellMenu,TableHandlesController,useBlockNoteEditor,useComponentsContext,useExtensionState,type TableCellButtonProps} from '@blocknote/react';
import {applyTableBorderPreset,applyTableVerticalAlignment,tableCellAnchors,type TableBorderLine,type TableBorderPreset,type TableContent,type TableVerticalAlignment} from '../../editor/table';
import {EditorContext} from './schema';

const options:{preset:TableBorderPreset;zh:string;en:string}[]=[
 {preset:'all',zh:'全部边框',en:'All borders'},
 {preset:'outside',zh:'外侧边框',en:'Outside borders'},
 {preset:'inside',zh:'内部边框',en:'Inside borders'},
 {preset:'top',zh:'上边框',en:'Top border'},
 {preset:'bottom',zh:'下边框',en:'Bottom border'},
 {preset:'left',zh:'左边框',en:'Left border'},
 {preset:'right',zh:'右边框',en:'Right border'},
 {preset:'none',zh:'无边框',en:'No border'},
];

function selectedCoordinates(editor:{prosemirrorState:{selection:object}},table:TableContent,current:{row:number;column:number}){
 const anchors=tableCellAnchors(table),selection=editor.prosemirrorState.selection;
 if(!(selection instanceof CellSelection))return [current];
 const tableNode=selection.$anchorCell.node(-1),start=selection.$anchorCell.start(-1),rect=TableMap.get(tableNode).rectBetween(selection.$anchorCell.pos-start,selection.$headCell.pos-start);
 if(current.row<rect.top||current.row>=rect.bottom||current.column<rect.left||current.column>=rect.right)return [current];
 const selected=anchors.filter(anchor=>anchor.row<rect.bottom&&anchor.row+anchor.rowspan>rect.top&&anchor.column<rect.right&&anchor.column+anchor.colspan>rect.left).map(({row,column})=>({row,column}));
 return selected.length?selected:[current];
}

function BorderMenu(){
 const Components=useComponentsContext()!;const editor=useBlockNoteEditor();const {locale}=useContext(EditorContext);const [width,setWidth]=useState<1|2|3>(1);const [color,setColor]=useState('#6b7280');
 const {block,rowIndex,colIndex}=useExtensionState(TableHandlesExtension,{selector:state=>({block:state?.block,rowIndex:state?.rowIndex,colIndex:state?.colIndex})});
 if(!block||rowIndex===undefined||colIndex===undefined)return null;
 const table=block.content as TableContent,anchor=tableCellAnchors(table).find(item=>item.rowIndex===rowIndex&&item.cellIndex===colIndex);if(!anchor)return null;const tableBlock=block as typeof block&{props:{borderData?:string}};
 const apply=(preset:TableBorderPreset)=>{const line:TableBorderLine={width,color};const coordinates=selectedCoordinates(editor,table,{row:anchor.row,column:anchor.column});const borderData=applyTableBorderPreset(tableBlock.props.borderData??'',table,coordinates,preset,line);editor.updateBlock(block,{props:{borderData} as never});};
 return <Components.Generic.Menu.Root position="right" sub>
  <Components.Generic.Menu.Trigger sub><Components.Generic.Menu.Item className="bn-menu-item" subTrigger>{locale==='en'?'Borders':'边框'}</Components.Generic.Menu.Item></Components.Generic.Menu.Trigger>
  <Components.Generic.Menu.Dropdown sub className="bn-menu-dropdown bn-table-border-menu">
   <div className="bn-table-border-settings" onClick={event=>event.stopPropagation()}>
    <span>{locale==='en'?'Line':'线条'}</span><div className="bn-table-border-widths" role="group" aria-label={locale==='en'?'Border width':'边框粗细'}>{([1,2,3] as const).map(value=><button key={value} type="button" aria-pressed={width===value} onClick={()=>setWidth(value)}><span style={{borderTopWidth:value}}/>{value}px</button>)}</div>
    <label><span>{locale==='en'?'Colour':'颜色'}</span><input type="color" aria-label={locale==='en'?'Border colour':'边框颜色'} value={color} onChange={event=>setColor(event.target.value)}/></label>
   </div>
   {options.map(option=><Components.Generic.Menu.Item key={option.preset} onClick={()=>apply(option.preset)}>{locale==='en'?option.en:option.zh}</Components.Generic.Menu.Item>)}
  </Components.Generic.Menu.Dropdown>
 </Components.Generic.Menu.Root>;
}
function VerticalAlignMenu(){
 const Components=useComponentsContext()!;const editor=useBlockNoteEditor();const {locale}=useContext(EditorContext);
 const {block,rowIndex,colIndex}=useExtensionState(TableHandlesExtension,{selector:state=>({block:state?.block,rowIndex:state?.rowIndex,colIndex:state?.colIndex})});
 if(!block||rowIndex===undefined||colIndex===undefined)return null;
 const table=block.content as TableContent,anchor=tableCellAnchors(table).find(item=>item.rowIndex===rowIndex&&item.cellIndex===colIndex);if(!anchor)return null;const tableBlock=block as typeof block&{props:{verticalAlignData?:string}};
 const apply=(alignment:TableVerticalAlignment)=>{const coordinates=selectedCoordinates(editor,table,{row:anchor.row,column:anchor.column});const verticalAlignData=applyTableVerticalAlignment(tableBlock.props.verticalAlignData??'',table,coordinates,alignment);editor.updateBlock(block,{props:{verticalAlignData} as never});};
 const options:{alignment:TableVerticalAlignment;zh:string;en:string}[]=[{alignment:'top',zh:'靠上',en:'Top'},{alignment:'middle',zh:'居中',en:'Middle'},{alignment:'bottom',zh:'靠下',en:'Bottom'}];
 return <Components.Generic.Menu.Root position="right" sub>
  <Components.Generic.Menu.Trigger sub><Components.Generic.Menu.Item className="bn-menu-item" subTrigger>{locale==='en'?'Vertical alignment':'垂直对齐'}</Components.Generic.Menu.Item></Components.Generic.Menu.Trigger>
  <Components.Generic.Menu.Dropdown sub className="bn-menu-dropdown">{options.map(option=><Components.Generic.Menu.Item key={option.alignment} onClick={()=>apply(option.alignment)}>{locale==='en'?option.en:option.zh}</Components.Generic.Menu.Item>)}</Components.Generic.Menu.Dropdown>
 </Components.Generic.Menu.Root>;
}
function CustomTableCellMenu(){return <TableCellMenu><SplitButton/><ColorPickerButton/><BorderMenu/><VerticalAlignMenu/></TableCellMenu>;}
function CustomTableCellButton(props:TableCellButtonProps){return <TableCellButton {...props} tableCellMenu={CustomTableCellMenu}/>;}

export function TableBorderControls(){return <TableHandlesController tableCellHandle={CustomTableCellButton}/>;}
