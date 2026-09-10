import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { zhCN } from '@clerk/localizations';
import { clerkConfiguration } from '../config/clerk';
import {THEME_BOOTSTRAP} from '../reader/theme';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'JUYU Help Centre', template: '%s · JUYU Help Centre' },
  description: 'JUYU 内部资料库',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  const content = clerkConfiguration(process.env) === 'configured'
    ? <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.trim()} localization={zhCN} allowedRedirectOrigins={[new URL(process.env.APP_ORIGIN!.trim()).origin]} signInUrl="/sign-in" signInForceRedirectUrl="/help-centre" signUpForceRedirectUrl="/help-centre" afterSignOutUrl="/sign-in" appearance={{ variables: { colorPrimary: '#ae2832', borderRadius: '6px' } }}>{children}</ClerkProvider>
    : children;
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: THEME_BOOTSTRAP}}/></head><body>{content}</body></html>;
}
