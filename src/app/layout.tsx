import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { zhCN } from '@clerk/localizations';
import {RootProvider} from 'fumadocs-ui/provider/next';
import { clerkConfiguration } from '../config/clerk';
import {fumadocsRootI18n} from '../fumadocs/i18n';
import './globals.css';
import './product-shell.css';
import './review-layout.css';
import './feedback.css';
import './reader-gitbook.css';
// Supabase session pools are in ap-southeast-1; avoid trans-Pacific SQL round trips.
export const preferredRegion = 'sin1';

export const metadata: Metadata = {
  title: { default: 'JUYU Help Centre', template: '%s · JUYU Help Centre' },
  description: 'JUYU 内部资料库',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  const content = clerkConfiguration(process.env) === 'configured'
    ? <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.trim()} localization={zhCN} allowedRedirectOrigins={[new URL(process.env.APP_ORIGIN!.trim()).origin]} signInUrl="/sign-in" signInForceRedirectUrl="/help-centre" signUpForceRedirectUrl="/help-centre" afterSignOutUrl="/sign-in" appearance={{ variables: { colorPrimary: '#ae2832', borderRadius: '6px' } }}>{children}</ClerkProvider>
    : children;
  return <html lang="zh-CN" suppressHydrationWarning><body><RootProvider i18n={fumadocsRootI18n('zh-CN')} search={{enabled:false}}>{content}</RootProvider></body></html>;
}
