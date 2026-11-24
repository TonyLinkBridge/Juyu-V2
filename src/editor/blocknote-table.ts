import {createExtension,defaultBlockSpecs} from '@blocknote/core';
import {Extension} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import {TableMap} from 'prosemirror-tables';
import {normalizeTableBorderData,normalizeTableVerticalAlignData,tableCellBorderStyle,tableCellVerticalAlignStyle,tableCellColorStyle} from './table.ts';

const borderAttributes=Extension.create({
 name:'juyuTablePresentation',
 addGlobalAttributes(){return [{types:['table'],attributes:{
  borderData:{default:'',parseHTML:element=>{try{return normalizeTableBorderData(element.getAttribute('data-border-data')??'');}catch{return '';}},renderHTML:attributes=>{try{const value=normalizeTableBorderData(attributes.borderData);return value?{'data-border-data':value}:{};}catch{return {};}}},
  verticalAlignData:{default:'',parseHTML:element=>{try{return normalizeTableVerticalAlignData(element.getAttribute('data-vertical-align-data')??'');}catch{return '';}},renderHTML:attributes=>{try{const value=normalizeTableVerticalAlignData(attributes.verticalAlignData);return value?{'data-vertical-align-data':value}:{};}catch{return {};}}},
 }}];},
 addProseMirrorPlugins(){return [new Plugin({key:new PluginKey('juyuTablePresentationDecorations'),props:{decorations(state){const decorations:Decoration[]=[];state.doc.descendants((node,position)=>{if(node.type.name!=='table')return;const map=TableMap.get(node),seen=new Set<number>();for(let index=0;index<map.map.length;index++){const relative=map.map[index];if(seen.has(relative))continue;seen.add(relative);const cell=node.nodeAt(relative);if(!cell)continue;const row=Math.floor(index/map.width),column=index%map.width,cellStyle={...tableCellColorStyle(cell.attrs),...tableCellBorderStyle(String(node.attrs.borderData??''),row,column),...tableCellVerticalAlignStyle(String(node.attrs.verticalAlignData??''),row,column)},style=Object.entries(cellStyle).filter(([,value])=>value!==undefined).map(([key,value])=>`${key.replace(/[A-Z]/g,character=>`-${character.toLowerCase()}`)}:${value}`).join(';');decorations.push(Decoration.node(position+1+relative,position+1+relative+cell.nodeSize,{style}));}});return DecorationSet.create(state.doc,decorations);}}})];},
});

const nativeTable=defaultBlockSpecs.table;
// The compact tab editor needs colors only, without introducing border/alignment props into its schema.
const cellColors=Extension.create({
 name:'juyuTableCellColors',
 addProseMirrorPlugins(){return [new Plugin({key:new PluginKey('juyuTableCellColors'),props:{decorations(state){
  const decorations:Decoration[]=[];
  state.doc.descendants((node,position)=>{
   if(node.type.name!=='table')return;
   const seen=new Set<number>();
   for(const relative of TableMap.get(node).map){
    if(seen.has(relative))continue;seen.add(relative);const cell=node.nodeAt(relative);if(!cell)continue;
    const style=Object.entries(tableCellColorStyle(cell.attrs)).filter(([,value])=>value!==undefined).map(([key,value])=>`${key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}:${value}`).join(';');
    if(style)decorations.push(Decoration.node(position+1+relative,position+1+relative+cell.nodeSize,{style}));
   }
  });return DecorationSet.create(state.doc,decorations);
 }}})];},
});
export const coloredTableSpec={...nativeTable,extensions:[...(nativeTable.extensions??[]),createExtension({key:'juyu-table-cell-colors',tiptapExtensions:[cellColors]})]};
export const borderTableSpec={
 ...nativeTable,
 config:{...nativeTable.config,propSchema:{...nativeTable.config.propSchema,borderData:{default:''},verticalAlignData:{default:''}}},
 extensions:[...(nativeTable.extensions??[]),createExtension({key:'juyu-table-borders',tiptapExtensions:[borderAttributes]})],
};
