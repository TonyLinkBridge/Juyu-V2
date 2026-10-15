import assert from 'node:assert/strict';
import test from 'node:test';
import {publicationPathValue,publicationSlug,publicationSlugPath} from '../src/fumadocs/slugs.ts';

test('publication slug follows a stable Fumadocs page segment without inventing a translation',()=>{
 assert.equal(publicationSlug(' 普通会员 '),'普通会员');
 assert.equal(publicationSlug('MFA 多重身份验证'),'mfa-多重身份验证');
 assert.equal(publicationSlug('  Account   Security  '),'account-security');
 assert.equal(publicationSlug('如何绑定手机认证？'),'如何绑定手机认证');
 assert.equal(publicationSlug('账户／安全'),'账户-安全');
});

test('publication slug rejects path syntax and keeps the section route canonical',()=>{
 assert.throws(()=>publicationSlug('///'),/INVALID_SLUG/);
 assert.equal(publicationSlugPath('普通会员','article'),'/help-centre/articles/%E6%99%AE%E9%80%9A%E4%BC%9A%E5%91%98');
 assert.equal(publicationSlugPath('ops-upgrade','ops'),'/help-centre/ops/ops-upgrade');
});

test('publication path restores an encoded Chinese slug before database lookup',()=>{
 assert.equal(publicationPathValue('%E6%99%AE%E9%80%9A%E4%BC%9A%E5%91%98'),'普通会员');
 assert.equal(publicationPathValue('普通会员'),'普通会员');
 assert.throws(()=>publicationPathValue('%E6%99%AE%E9%80'),/INVALID_PUBLICATION_PATH/);
 assert.throws(()=>publicationPathValue('%25E6%2599%25AE%25E9%2580%259A%25E4%25BC%259A%25E5%2591%2598'),/INVALID_PUBLICATION_PATH/);
 assert.throws(()=>publicationPathValue('member%2Fadmin'),/INVALID_PUBLICATION_PATH/);
});

for(const slug of ['签约店铺（个人-企业）','为什么触发强制登录验证？','账户／安全','ＡＰＩ－密钥','版本＃１％','cafe\u0301']){
 test(`existing publication links preserve the stored segment: ${slug}`,()=>{
  assert.equal(publicationPathValue(slug),slug);
  assert.equal(publicationPathValue(encodeURIComponent(slug)),slug);
  assert.equal(publicationSlugPath(slug),`/help-centre/articles/${encodeURIComponent(slug)}`);
  assert.equal(publicationSlugPath(slug,'ops'),`/help-centre/ops/${encodeURIComponent(slug)}`);
 });
}

test('publication path validation accepts the database length bound without applying new-slug rules',()=>{
 const slug='资料'.repeat(125);
 assert.equal(publicationPathValue(encodeURIComponent(slug)),slug);
 const supplementary='𠀀'.repeat(250);
 assert.equal(publicationPathValue(encodeURIComponent(supplementary)),supplementary);
 assert.throws(()=>publicationPathValue(encodeURIComponent(slug+'字')),/INVALID_PUBLICATION_PATH/);
});

test('legacy punctuation compatibility still rejects unsafe or ambiguous URL segments',()=>{
 for(const value of ['', ' ', 'member/admin', 'member\\admin', 'member?admin', 'member#admin', 'member%admin',
  'member%252Fadmin', 'member%2fadmin', 'member%5cadmin', 'member%3fadmin', 'member%23admin', 'member%00admin',
  'member%0aadmin','member%7fadmin','member%20admin','%E6%99%AE%E9%80','.','..','a'.repeat(251)]){
  assert.throws(()=>publicationPathValue(value),/INVALID_PUBLICATION_PATH/,value);
 }
});
