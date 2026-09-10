import { redirect } from 'next/navigation';
import { employeeSession } from '../server/authentication/clerk';
import { employeeDestination } from '../server/authentication/session';
export const dynamic = 'force-dynamic';
export default async function Page() { redirect(employeeDestination(await employeeSession())); }
