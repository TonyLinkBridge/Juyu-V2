import 'server-only';
import {cache} from 'react';
import { clerkConfiguration } from '../../config/clerk.ts';
import { resolveEmployeeSession } from './session.ts';

export const employeeSession = cache(async function employeeSession() {
  return resolveEmployeeSession(clerkConfiguration(process.env), {
    current: async () => {
      const {auth}=await import('@clerk/nextjs/server');
      const identity = await auth({ acceptsToken: 'session_token' });
      return { userId: identity.userId, sessionId: identity.sessionId };
    },
  });
});
