import type { Metadata } from 'next';
import { LoginError } from '../../../../components/login-error';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '后台登录遇到问题' };
export default function AdminLoginError() { return <LoginError audience="admin" />; }
