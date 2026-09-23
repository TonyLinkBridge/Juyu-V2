import assert from 'node:assert/strict';
import test from 'node:test';
import {BlockNoteEditor,BlockNoteSchema,defaultBlockSpecs,defaultInlineContentSpecs,defaultStyleSpecs} from '@blocknote/core';
import {borderTableSpec} from '../src/editor/blocknote-table.ts';

test('BlockNote keeps table border and vertical alignment data through edits and snapshots',()=>{
 const schema=BlockNoteSchema.create({blockSpecs:{...defaultBlockSpecs,table:borderTableSpec},inlineContentSpecs:defaultInlineContentSpecs,styleSpecs:defaultStyleSpecs});
 const borderData=JSON.stringify({'0:0':{bottom:{width:2,color:'#cc2233'}}});
 const verticalAlignData=JSON.stringify({'0:0':'bottom'});
 const editor=BlockNoteEditor.create({schema,initialContent:[{type:'table',props:{borderData,verticalAlignData},content:{type:'tableContent',rows:[{cells:['A']}]}}]});
 assert.equal(editor.document[0].type,'table');
 assert.equal(editor.document[0].props.borderData,borderData);
 assert.equal(editor.document[0].props.verticalAlignData,verticalAlignData);
 editor.updateBlock(editor.document[0],{props:{borderData:JSON.stringify({'0:0':{right:null}}),verticalAlignData:JSON.stringify({'0:0':'middle'})}});
 assert.equal(editor.document[0].props.borderData,JSON.stringify({'0:0':{right:null}}));
 assert.equal(editor.document[0].props.verticalAlignData,JSON.stringify({'0:0':'middle'}));
});
