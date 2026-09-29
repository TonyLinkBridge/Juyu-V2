import assert from 'node:assert/strict';
import test from 'node:test';
import {publicationSlug,publicationSlugPath} from '../src/fumadocs/slugs.ts';

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
