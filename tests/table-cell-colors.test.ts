import test from 'node:test';
import assert from 'node:assert/strict';
import {tableCellColorStyle} from '../src/editor/table.ts';
test('cell colors use reader semantics for literal colors, default ink and solid backgrounds',()=>{
 assert.deepEqual(tableCellColorStyle({textColor:'#fff',backgroundColor:'rgb(31, 78, 121)'}),{color:'#fff',backgroundColor:'rgb(31, 78, 121)','--reader-neutral-ink':'#000'});
 assert.equal(tableCellColorStyle({textColor:'#000',backgroundColor:'default'}).color,'var(--reader-neutral-ink, var(--ink))');
 assert.equal(tableCellColorStyle({backgroundColor:'red'}).color,'#fff');
});
test('cell presentation rejects executable or malformed CSS without dropping valid neighboring colors',()=>{
 const style=tableCellColorStyle({textColor:'#fff',backgroundColor:'red;position:fixed'});
 assert.equal(style.color,'#fff');assert.equal(style.backgroundColor,undefined);
 assert.equal(tableCellColorStyle({backgroundColor:'url(https://example.test)'}).backgroundColor,undefined);
});
