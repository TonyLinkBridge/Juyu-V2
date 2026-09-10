import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { clerkConfiguration } from '../../config/clerk.ts';
import { resolveEmployeeSession } from './session.ts';

export async function employeeSession() {
  return resolveEmployeeSession(clerkConfiguration(process.env), {
    current: async () => {
      const identity = await auth({ acceptsToken: 'session_token' });
      return { userId: identity.userId, sessionId: identity.sessionId };
    },
    // No application cache: a previously valid JWT alone does not prove the session is still active.
    session: async (id) => (await clerkClient()).sessions.getSession(id),
  });
}
