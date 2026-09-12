import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pdfContent} from '../src/pdf/render.ts';
test('PDF displays publication number rather than internal draft revision',()=>{
 const html=pdfContent({id:'test',title:'Example',body:'Text',revision:22,publicationNumber:1});
 assert.match(html,/正式版本 1/);assert.doesNotMatch(html,/正式版本 22/);
 assert.doesNotMatch(pdfContent({id:'test',title:'Example',body:'Text',revision:22}),/正式版本 22/);
});
