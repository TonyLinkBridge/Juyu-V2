import { loginFlow, type LoginAudience } from './login-flow.ts';
type SignOut = (options: { sessionId: string; redirectUrl: string }) => Promise<void>;
export async function signOutCurrentSession(signOut: SignOut, sessionId: string, audience: LoginAudience = 'employee') {
  if (!sessionId.trim()) throw new Error('SESSION_REQUIRED');
  await signOut({ sessionId, redirectUrl: loginFlow(audience).signIn });
}

/** Recovery does not require a readable active session. Clerk resets this browser client only. */
export async function signOutForRecovery(signOut: (options: { sessionId?: string; redirectUrl: string }) => Promise<void>, sessionId: string | null | undefined, audience: LoginAudience = 'employee', timeoutMs = 10000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      signOut({ ...(sessionId?.trim() ? { sessionId } : {}), redirectUrl: loginFlow(audience).signIn }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SIGN_OUT_UNCONFIRMED')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
