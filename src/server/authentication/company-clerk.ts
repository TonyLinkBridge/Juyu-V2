import 'server-only';
import { cache } from 'react';
import { clerkClient } from '@clerk/nextjs/server';
import { employeeSession } from './clerk.ts';
import { verifyCompanyAccount } from './company.ts';
import { slackUserInfo } from './slack.ts';
import {readClerkUser} from './user-read.ts';
import {measured} from '../performance.ts';

// React shares this promise only within the current server render. Route handlers
// and later requests still verify independently; this is not a TTL/session cache.
export const employeeCompanyAccess = cache(async function employeeCompanyAccess() {
  const session = await employeeSession();
  return measured('company.verify',()=>verifyCompanyAccount(session, process.env, {
    user: readClerkUser,
    tokens: async id => measured('clerk.tokens',async()=>(await (await clerkClient()).users.getUserOauthAccessToken(id, 'slack')).data),
    slack: token => measured('slack.userinfo',()=>slackUserInfo(token)),
  }));
});
