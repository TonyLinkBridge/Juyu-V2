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

test('Slack message only links to the application and escapes untrusted title text',()=>{
 const message=slackMessage({document_id:'doc-1',sequence:3,event:'submitted',kind:'article',locale:'zh-CN',title:'<script>&',actor_name:'作者',reviewer_name:'审核者',attempts:1},{token:'not-shared',channel:'C0BQ4M16EDB',origin:'https://juyu-helpcentre.vercel.app'});
 assert.match(message.text,/&lt;script&gt;&amp;/);
 const actions=message.blocks[1];assert.ok(actions&&'elements' in actions&&actions.elements);
 assert.equal(actions.elements[0]?.url,'https://juyu-helpcentre.vercel.app/admin/editor?article=doc-1');
 assert.doesNotMatch(JSON.stringify(message),/not-shared/);
});
