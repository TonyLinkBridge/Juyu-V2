import 'server-only';
import {cache} from 'react';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { clerkConfiguration } from '../../config/clerk.ts';
import { resolveEmployeeSession } from './session.ts';

export const employeeSession = cache(async function employeeSession() {
  return resolveEmployeeSession(clerkConfiguration(process.env), {
    current: async () => {
      const identity = await auth({ acceptsToken: 'session_token' });
      return { userId: identity.userId, sessionId: identity.sessionId };
    },
    // Each render/request checks the provider; a JWT alone never proves an active session.
    session: async (id) => (await clerkClient()).sessions.getSession(id),
  });
});
