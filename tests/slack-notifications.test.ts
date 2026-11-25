import assert from 'node:assert/strict';
import {test} from 'node:test';
import {notificationEvent} from '../src/server/slack/notification-event.ts';
import {slackMessage} from '../src/server/slack/dispatch.ts';

test('only the first saved edit of a published article starts a revision notification',()=>{
 assert.equal(notificationEvent('edit','published',1), 'revision_started');
 assert.equal(notificationEvent('edit','draft',1), null);
 assert.equal(notificationEvent('edit','draft',null), null);
});

test('publishing distinguishes a first release from an update',()=>{
 assert.equal(notificationEvent('publish','queued',null), 'published');
 assert.equal(notificationEvent('direct_publish','draft',1), 'updated');
 assert.equal(notificationEvent('submit','draft',1), 'submitted');
 assert.equal(notificationEvent('approve','in_review',1), 'approved');
 assert.equal(notificationEvent('reject','in_review',1), 'changes_requested');
 assert.equal(notificationEvent('queue','approved',1), null);
});

test('Slack message hides queued titles, links to the application and escapes actor text',()=>{
 const message=slackMessage({document_id:'doc-1',sequence:3,event:'submitted',kind:'article',locale:'zh-CN',title:'private-queued-title',actor_name:'<script>&',reviewer_name:'审核者',attempts:1},{token:'not-shared',channel:'C0BQ4M16EDB',origin:'https://juyu-helpcentre.vercel.app'});
 assert.match(message.text,/资料：受限资料/);
 assert.doesNotMatch(JSON.stringify(message),/private-queued-title/);
 assert.match(message.text,/&lt;script&gt;&amp;/);
 const actions=message.blocks[1];assert.ok(actions&&'elements' in actions&&actions.elements);
 assert.equal(actions.elements[0]?.url,'https://juyu-helpcentre.vercel.app/admin/editor?article=doc-1');
 assert.doesNotMatch(JSON.stringify(message),/not-shared/);
});

test('return notifications open protected review details for every kind without posting the private reason',()=>{
 for(const kind of ['article','ops','reference','qa'] as const){
  const message=slackMessage({document_id:'doc /?一',sequence:3,event:'changes_requested',kind,locale:'zh-CN',title:'测试资料',actor_name:'审核人',reviewer_name:null,attempts:1},{token:'not-shared',channel:'C0BQ4M16EDB',origin:'https://example.test'});
  const actions=message.blocks[1];assert.ok(actions&&'elements' in actions&&actions.elements);
  assert.equal(actions.elements[0]?.url,'https://example.test/admin/review?article=doc%20%2F%3F%E4%B8%80');
  assert.equal(actions.elements[0]?.text.text,'查看退回原因');
  assert.doesNotMatch(JSON.stringify(message),/not-shared/);
 }
});


test('every workflow event hides legacy queued titles in both locales',()=>{
 for(const event of ['revision_started','submitted','approved','changes_requested','published','updated'] as const){
  for(const locale of ['zh-CN','en'] as const){
   for(const title of [null,'restricted-title-from-old-queue']){
    const message=slackMessage({document_id:'doc-1',sequence:3,event,kind:'article',locale,title,actor_name:'author',reviewer_name:null,attempts:1},{token:'dummy-token',channel:'C0BQ4M16EDB',origin:'https://example.test'});
    assert.match(message.text,/资料：受限资料/);
    assert.doesNotMatch(JSON.stringify(message),/restricted-title-from-old-queue|dummy-token/);
   }
  }
 }
});
