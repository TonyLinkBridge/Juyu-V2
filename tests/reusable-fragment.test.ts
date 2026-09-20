import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyReusableBlocks,reusableFragmentInput,createReusableWrapper,refreshReusableWrapper,reusableReferences,reusableAssetIds} from '../src/editor/reusable-fragment.ts';

const id='11111111-1111-4111-8111-111111111111';
const paragraph={id:'source',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'请先核对资料',styles:{bold:true,textColor:'red'}}],children:[]};

test('reusable text keeps editor formatting and receives fresh block identities on insertion',()=>{
 const input=reusableFragmentInput({id,title:' 核对资料 ',blocks:[paragraph]});
 assert.equal(input.title,'核对资料');
 assert.equal(input.blocks[0].type,'paragraph');
 const inserted=copyReusableBlocks(input.blocks,()=> 'fresh');
 assert.equal(inserted[0].id,'fresh');
 assert.ok('content' in inserted[0]&&'content' in input.blocks[0]);
 assert.deepEqual(inserted[0].content,input.blocks[0].content);
 assert.equal(input.blocks[0].id,'source');
});

test('reusable fragment accepts media but refuses to insert an un-copied cross-article asset',()=>{
 const assetId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',targetId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const image={id:'image',type:'image',props:{backgroundColor:'default',name:'proof.png',url:'/api/assets/'+assetId,caption:''},children:[]};
 const fragment=reusableFragmentInput({id,title:'image',blocks:[image]});
 assert.throws(()=>copyReusableBlocks(fragment.blocks,()=>crypto.randomUUID()),/FRAGMENT_ASSET_NOT_COPIED/);
 const copied=copyReusableBlocks(fragment.blocks,()=>crypto.randomUUID(),{[assetId]:targetId});
 assert.equal(copied[0].type,'image');if(copied[0].type==='image')assert.equal(copied[0].props.url,'/api/assets/'+targetId);
 assert.throws(()=>reusableFragmentInput({id,title:'text',blocks:[paragraph],audience:'staff'}),/INVALID_INPUT/);
 assert.throws(()=>reusableFragmentInput({id,title:'text',blocks:Array.from({length:21},(_,index)=>({...paragraph,id:String(index)}))}),/INVALID_INPUT/);
});

test('a fragment insert pins an immutable version and refresh makes a new article draft snapshot',()=>{
 const first={id,familyId:id,version:1,title:'账户核对',blocks:reusableFragmentInput({id,title:'账户核对',blocks:[paragraph]}).blocks,createdAt:'2026-09-20T00:00:00.000Z',sourceDocumentId:null};
 const wrapper=createReusableWrapper(first,()=>crypto.randomUUID());
 assert.equal(wrapper.type,'juyu');
 if(wrapper.type!=='juyu')return;
 assert.equal(JSON.parse(wrapper.props.payload).version,1);
 assert.deepEqual(reusableReferences([wrapper]).map(item=>({familyId:item.familyId,version:item.version})),[{familyId:id,version:1}]);
 assert.equal(wrapper.children.length,1);
 const newer={...first,id:'22222222-2222-4222-8222-222222222222',version:2,blocks:reusableFragmentInput({id,title:'账户核对',blocks:[{...paragraph,content:[{type:'text',text:'更新后的核对说明',styles:{}}]}]}).blocks};
 const refreshed=refreshReusableWrapper(wrapper,newer,()=>crypto.randomUUID());
 assert.equal(refreshed.id,wrapper.id);
 if(refreshed.type!=='juyu')return;
 assert.equal(JSON.parse(refreshed.props.payload).version,2);
 assert.notEqual(refreshed.children[0].id,wrapper.children[0].id);
 assert.equal(JSON.parse(wrapper.props.payload).version,1);
});
test('rich image variants and inline image references also receive target-owned asset IDs',()=>{
 const source='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',dark='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',target='cccccccc-cccc-4ccc-8ccc-cccccccccccc',darkTarget='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 const rich={id:'rich',type:'juyu',props:{payload:JSON.stringify({id:'rich',type:'image',assetId:source,darkAssetId:dark,caption:'',alt:'截图'})},children:[]};
 const inline={...paragraph,id:'inline',content:[{type:'link',href:`#juyu-image-${source}`,content:[{type:'text',text:'行内截图',styles:{}}]}]};
 const blocks=reusableFragmentInput({id,title:'图文',blocks:[rich,inline]}).blocks;
 assert.deepEqual(reusableAssetIds(blocks),[source,dark]);
 assert.throws(()=>copyReusableBlocks(blocks,()=>crypto.randomUUID(),{[source]:target}),/FRAGMENT_ASSET_NOT_COPIED/);
 const copied=copyReusableBlocks(blocks,()=>crypto.randomUUID(),{[source]:target,[dark]:darkTarget});
 assert.equal(copied[0].type,'juyu');if(copied[0].type==='juyu'){const payload=JSON.parse(copied[0].props.payload);assert.equal(payload.assetId,target);assert.equal(payload.darkAssetId,darkTarget);assert.equal(payload.id,copied[0].id);}
 assert.equal(copied[1].type,'paragraph');if(copied[1].type==='paragraph')assert.equal(copied[1].content[0].type,'link');
 if(copied[1].type==='paragraph'&&copied[1].content[0].type==='link')assert.equal(copied[1].content[0].href,`#juyu-image-${target}`);
});
