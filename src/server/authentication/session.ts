import type { ClerkConfiguration } from '../../config/clerk.ts';
export type EmployeeSession =
  | { status: 'unconfigured' | 'signed_out' | 'unavailable' }
  | { status: 'signed_in'; sessionId: string; userId: string };
export interface SessionProvider {
  current(): Promise<{ userId: string | null; sessionId: string | null } | null>;
  session(id: string): Promise<{ id: string; userId: string; status: string } | null>;
}

/** Identity only. This never constructs a company-verified Viewer or grants a role. */
export async function resolveEmployeeSession(configuration: ClerkConfiguration, provider: SessionProvider): Promise<EmployeeSession> {
  if (configuration !== 'configured') return { status: 'unconfigured' };
  try {
    const current = await provider.current();
    if (!current?.userId || !current.sessionId) return { status: 'signed_out' };
    const session = await provider.session(current.sessionId);
    if (!session || session.status !== 'active' || session.id !== current.sessionId || session.userId !== current.userId) return { status: 'signed_out' };
    return { status: 'signed_in', userId: session.userId, sessionId: session.id };
  } catch { return { status: 'unavailable' }; }
}

// Deliberately accepts no return URL, query string, host header or user-provided destination.
export function employeeDestination(session: EmployeeSession): '/help-centre' | '/sign-in' | '/sign-in/error' {
  if (session.status === 'signed_in') return '/help-centre';
  if (session.status === 'unavailable') return '/sign-in/error';
  return '/sign-in';
}
