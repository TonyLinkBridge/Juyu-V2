import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { cleanLoginRedirects } from './authentication/login-flow';
import { clerkConfiguration } from './config/clerk';

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const clean = cleanLoginRedirects(request.nextUrl);
  if (clean) return NextResponse.redirect(clean, { headers: { 'Cache-Control': 'private, no-store' } });
  // Keep health and recovery independent of the identity provider, including during an outage.
  const bypass = ['/api/health', '/api/readiness', '/sign-in/error', '/admin/sign-in/error'].includes(request.nextUrl.pathname);
  const admin = request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/') || request.nextUrl.pathname.startsWith('/api/admin/');
  let response;
  try {
    response = !bypass && clerkConfiguration(process.env) === 'configured'
      ? await clerkMiddleware({ authorizedParties: [new URL(process.env.APP_ORIGIN!.trim()).origin], signInUrl: admin ? '/admin/sign-in' : '/sign-in' })(request, event)
      : NextResponse.next();
  } catch {
    response = request.nextUrl.pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'AUTH_UNAVAILABLE' }, { status: 503 })
      : NextResponse.redirect(new URL(admin ? '/admin/sign-in/error' : '/sign-in/error', request.url));
  }
  if (response instanceof Response) response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
