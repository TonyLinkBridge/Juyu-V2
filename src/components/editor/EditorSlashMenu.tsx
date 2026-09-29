'use client';
import {filterSuggestionItems} from '@blocknote/core/extensions';
import {SuggestionMenuController,getDefaultReactSlashMenuItems,useBlockNoteEditor,useDictionary} from '@blocknote/react';

export function EditorSlashMenu(){
 const editor=useBlockNoteEditor();
 const dictionary=useDictionary();
 const hiddenTitles=new Set([dictionary.slash_menu.toggle_list.title,dictionary.slash_menu.toggle_heading.title,dictionary.slash_menu.toggle_heading_2.title,dictionary.slash_menu.toggle_heading_3.title]);
 return <SuggestionMenuController triggerCharacter="/" shouldOpen={view=>!view.selection.$from.parent.type.isInGroup('tableContent')} getItems={async query=>filterSuggestionItems(getDefaultReactSlashMenuItems(editor).filter(item=>!hiddenTitles.has(item.title)),query)}/>;
}
