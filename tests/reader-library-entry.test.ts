import test from 'node:test';
import assert from 'node:assert/strict';
import {firstTreePage,type NavigationNode} from '../src/reader/tree.ts';
test('library entry follows visible nested directory order',()=>{
 const pages:NavigationNode[]=[{type:'group',id:'empty',title:'Empty',descendants:[]},{type:'group',id:'account',title:'Account',descendants:[{type:'group',id:'security',title:'Security',descendants:[{type:'document',id:'email',title:'Email',href:'/help-centre?article=email'}]}]},{type:'document',id:'last',title:'Last',href:'/help-centre?article=last'}];
 assert.equal(firstTreePage(pages)?.id,'email');
});
test('empty authorized directory has no redirect target',()=>assert.equal(firstTreePage([]),null));
