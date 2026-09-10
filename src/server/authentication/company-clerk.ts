import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { employeeSession } from './clerk.ts';
import { verifyCompanyAccount } from './company.ts';
import { slackUserInfo } from './slack.ts';

export async function employeeCompanyAccess() {
  const session = await employeeSession();
  return verifyCompanyAccount(session, process.env, {
    user: async id => (await clerkClient()).users.getUser(id),
    tokens: async id => (await (await clerkClient()).users.getUserOauthAccessToken(id, 'slack')).data,
    slack: token => slackUserInfo(token),
  });
}
