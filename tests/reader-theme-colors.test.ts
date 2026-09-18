import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screenTextColor,displayColor,screenInlineStyle} from '../src/editor/inline.ts';
test('plain black ink follows screen theme without changing export color',()=>{
 for(const value of ['black','#000','#000000','rgb(0, 0, 0)','rgba(0,0,0,1)']){
 assert.equal(screenTextColor(value),'var(--reader-neutral-ink, var(--ink))');assert.equal(displayColor(value),value);
 }
});
test('authored emphasis and default inheritance remain intact',()=>{
 for(const value of ['red','#ff0000','blue','white','#ffffff',undefined,'default'])assert.equal(screenTextColor(value),displayColor(value));
});
test('red background is a strong brand-red emphasis in every document renderer',()=>{
 assert.equal(displayColor('red',true),'#ae2832');
 assert.equal(displayColor('red'),'#e03e3e');
 assert.equal(screenInlineStyle({backgroundColor:'red'}).color,'#fff');
});
