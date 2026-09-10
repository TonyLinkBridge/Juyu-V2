import type { Environment } from './readiness.ts';
export type ClerkConfiguration = 'missing' | 'invalid' | 'configured';

export function clerkConfiguration(env: Environment): ClerkConfiguration {
  const publicKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = env.CLERK_SECRET_KEY?.trim();
  const origin = env.APP_ORIGIN?.trim();
  if (!publicKey || !secretKey || !origin) return 'missing';
  if (publicKey !== env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || secretKey !== env.CLERK_SECRET_KEY) return 'invalid';
  const publishable = /^pk_(test|live)_([A-Za-z0-9+/]+={0,2})$/.exec(publicKey);
  const secret = /^sk_(test|live)_[A-Za-z0-9]+$/.exec(secretKey);
  if (!publishable || !secret || publishable[1] !== secret[1]) return 'invalid';
  const host = Buffer.from(publishable[2], 'base64').toString('utf8');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}\$$/i.test(host)) return 'invalid';
  try {
    const url = new URL(origin);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return 'invalid';
  } catch { return 'invalid'; }
  return 'configured';
}
