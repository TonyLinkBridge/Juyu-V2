import assert from 'node:assert/strict';
import test from 'node:test';
import {encodeEditorBody} from '../src/editor/document.ts';
import {publicationLinkFile,publicationLinkScanOptions} from '../src/fumadocs/link-files.ts';

test('database publication becomes the FileObject consumed by next-validate-link',()=>{
 const body=encodeEditorBody([
  {id:'heading-one',type:'heading',props:{level:1,textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'开始',styles:{}}],children:[]},
  {id:'paragraph-one',type:'paragraph',props:{textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'link',href:'/help-centre/articles/account-security#reset',content:[{type:'text',text:'重设账号',styles:{}}]}],children:[]},
 ]);
 const file=publicationLinkFile({id:'doc-one',kind:'article',slug:'普通会员',title:'普通会员',description:'基础会员说明',body,revision:3});
 assert.equal(file.path,'database/article/doc-one.md');
 assert.equal(file.url,'/help-centre/articles/%E6%99%AE%E9%80%9A%E4%BC%9A%E5%91%98');
 assert.deepEqual(file.data,{id:'doc-one',revision:3,kind:'article',slug:'普通会员'});
 assert.match(file.content,/\[重设账号\]\(\/help-centre\/articles\/account-security#reset\)/);
});

test('dynamic routes and anchors are populated from the database content source',()=>{
 const publications=[
  {id:'article-one',kind:'article' as const,slug:'普通会员',title:'普通会员',body:encodeEditorBody([{id:'member-intro',type:'heading',props:{level:1,textAlignment:'left',textColor:'default',backgroundColor:'default'},content:[{type:'text',text:'说明',styles:{}}],children:[]}]),revision:1,locale:'zh-CN' as const},
  {id:'ops-one',kind:'ops' as const,slug:'升级流程',title:'升级流程',body:encodeEditorBody([]),revision:2,locale:'zh-CN' as const},
  {id:'qa-one',kind:'qa' as const,slug:null,title:'怎么处理？',body:encodeEditorBody([]),revision:3,locale:'en' as const},
  {id:'ref-one',kind:'reference' as const,slug:null,title:'速查',body:encodeEditorBody([]),revision:4,locale:'zh-CN' as const},
 ];
 const options=publicationLinkScanOptions(publications);
 assert.deepEqual(options.populate?.['help-centre/articles/[articleId]'],[{value:{articleId:'普通会员'},hashes:['member-intro']}]);
 assert.deepEqual(options.populate?.['help-centre/ops/[articleId]'],[{value:{articleId:'升级流程'},hashes:[]}]);
 assert.deepEqual(options.meta?.['help-centre/qa']?.queries,[{question:'qa-one',lang:'en'}]);
 assert.deepEqual(options.meta?.['help-centre/reference']?.queries,[{article:'ref-one'}]);
 assert.equal(publicationLinkFile(publications[2]).url,'/help-centre/qa?question=qa-one&lang=en#qa-qa-one');
});

for(const slug of ['签约店铺（个人-企业）','为什么触发强制登录验证？']){
 test(`published link validation uses the original stored URL: ${slug}`,()=>{
  const publication={id:'legacy',kind:'article' as const,slug,title:slug,body:encodeEditorBody([]),revision:1};
  assert.equal(publicationLinkFile(publication).url,`/help-centre/articles/${encodeURIComponent(slug)}`);
  assert.deepEqual(publicationLinkScanOptions([publication]).populate?.['help-centre/articles/[articleId]'],[{value:{articleId:slug},hashes:[]}]);
 });
}
