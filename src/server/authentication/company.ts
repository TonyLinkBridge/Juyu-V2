import type { Environment } from '../../config/readiness.ts';
import type { EmployeeSession } from './session.ts';

type Verification = { status: string } | null;
export interface CompanyUser {
  id: string; banned: boolean; locked: boolean; primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: Verification }[];
  externalAccounts: { id: string; provider: string; providerUserId: string; emailAddress: string; verification: Verification }[];
}
export interface CompanyProvider {
  user(id: string): Promise<CompanyUser>;
  tokens(id: string): Promise<{ externalAccountId: string; provider: string; token: string }[]>;
  slack(token: string): Promise<unknown>;
}
export type CompanyAccess =
  | { status: 'unconfigured' | 'signed_out' | 'unavailable' }
  | { status: 'denied'; reason: 'company_email' | 'account' | 'slack_connection' | 'slack_identity' }
  | { status: 'verified'; userId: string; email: string; slackUserId: string; slackTeamId: string };

const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
export function companyPolicy(env: Environment) {
  const domains = env.ALLOWED_EMAIL_DOMAINS?.split(',').map(value => value.trim().toLowerCase());
  const teamId = env.ALLOWED_SLACK_TEAM_ID?.trim();
  if (!domains?.length || !domains.every(domain => domainPattern.test(domain)) || !teamId || !/^T[A-Z0-9]{7,63}$/.test(teamId)) return null;
  return { domains: [...new Set(domains)], teamId };
}
function email(value: string): string | null {
  if (!/^[^@\s]+@[^@\s]+$/.test(value)) return null;
  return value.toLowerCase();
}
const isSlack = (provider: string) => provider === 'slack' || provider === 'oauth_slack';

/** Revalidates server-owned evidence. Metadata, browser claims and unverified ID tokens are never read. */
export async function verifyCompanyAccount(session: EmployeeSession, env: Environment, provider: CompanyProvider): Promise<CompanyAccess> {
  if (session.status !== 'signed_in') return { status: session.status };
  return verifyCompanyUser(session.userId, env, provider);
}

/** Admin target verification checks company evidence, not an impersonated login session. */
export async function verifyCompanyUser(userId: string, env: Environment, provider: CompanyProvider): Promise<CompanyAccess> {
  const policy = companyPolicy(env);
  if (!policy) return { status: 'unconfigured' };
  try {
    const user = await provider.user(userId);
    if (user.id !== userId || user.banned || user.locked) return { status: 'denied', reason: 'account' };
    const primary = user.emailAddresses.find(item => item.id === user.primaryEmailAddressId);
    const address = primary && email(primary.emailAddress);
    if (!primary || primary.verification?.status !== 'verified' || !address || !policy.domains.includes(address.split('@')[1])) return { status: 'denied', reason: 'company_email' };
    const accounts = user.externalAccounts.filter(item => isSlack(item.provider) && item.verification?.status === 'verified' && email(item.emailAddress) === address);
    if (accounts.length !== 1) return { status: 'denied', reason: 'slack_connection' };
    const account = accounts[0];
    const tokens = (await provider.tokens(user.id)).filter(item => isSlack(item.provider) && item.externalAccountId === account.id);
    if (tokens.length !== 1 || !tokens[0].token.trim()) return { status: 'denied', reason: 'slack_connection' };
    const raw = await provider.slack(tokens[0].token);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { status: 'denied', reason: 'slack_identity' };
    const profile = raw as Record<string, unknown>;
    if (profile.ok !== true) {
      const rejected = ['access_denied', 'invalid_auth', 'token_revoked', 'token_expired', 'not_authed', 'missing_scope', 'no_permission', 'team_access_not_granted', 'account_inactive', 'two_factor_setup_required'];
      return profile.ok === false && typeof profile.error === 'string' && rejected.includes(profile.error)
        ? { status: 'denied', reason: 'slack_identity' } : { status: 'unavailable' };
    }
    if (profile.email_verified !== true || typeof profile.email !== 'string'
      || email(profile.email) !== address || profile['https://slack.com/team_id'] !== policy.teamId
      || typeof profile.sub !== 'string' || !/^[UW][A-Z0-9]+$/.test(profile.sub) || profile.sub !== account.providerUserId
      || (profile['https://slack.com/user_id'] !== undefined && profile['https://slack.com/user_id'] !== profile.sub)) return { status: 'denied', reason: 'slack_identity' };
    return { status: 'verified', userId: user.id, email: address, slackUserId: profile.sub, slackTeamId: policy.teamId };
  } catch { return { status: 'unavailable' }; }
}
