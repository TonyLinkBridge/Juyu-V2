import { employeeCompanyAccess } from '../../../../server/authentication/company-clerk';
import { companyResponse } from '../../../../server/authentication/company-response';
export const dynamic = 'force-dynamic';
export async function GET() { return companyResponse(await employeeCompanyAccess()); }
