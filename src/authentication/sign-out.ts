import { loginFlow, type LoginAudience } from './login-flow.ts';
type SignOut = (options: { sessionId: string; redirectUrl: string }) => Promise<void>;
export async function signOutCurrentSession(signOut: SignOut, sessionId: string, audience: LoginAudience = 'employee') {
  if (!sessionId.trim()) throw new Error('SESSION_REQUIRED');
  await signOut({ sessionId, redirectUrl: loginFlow(audience).signIn });
}
