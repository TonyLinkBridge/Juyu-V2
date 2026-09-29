import assert from 'node:assert/strict';
import test from 'node:test';
import {publicationPathValue,publicationSlug,publicationSlugPath} from '../src/fumadocs/slugs.ts';

test('publication slug follows a stable Fumadocs page segment without inventing a translation',()=>{
 assert.equal(publicationSlug(' 普通会员 '),'普通会员');
 assert.equal(publicationSlug('MFA 多重身份验证'),'mfa-多重身份验证');
 assert.equal(publicationSlug('  Account   Security  '),'account-security');
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
