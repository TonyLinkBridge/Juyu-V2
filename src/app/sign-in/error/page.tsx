import type { Metadata } from 'next';
import { LoginError } from '../../../components/login-error';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '登录遇到问题' };
export default function SignInError() { return <LoginError />; }
