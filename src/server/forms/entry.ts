import {redirect} from 'next/navigation';
import {clerkConfiguration} from '../../config/clerk';
import {employeeCompanyAccess} from '../authentication/company-clerk';
import {applicationEnrollment} from '../enrollment/application';
import {bindCurrentMember} from '../members/entry';
export async function requireFormReaderEntry(){const access=await employeeCompanyAccess();if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');if(access.status==='unavailable')redirect('/sign-in/error');if(access.status!=='verified')redirect('/help-centre');let ready=false;try{const enrollment=await(await applicationEnrollment()).inspect();if(enrollment.status==='ready'){await bindCurrentMember();ready=true;}}catch{}if(!ready)redirect('/help-centre');}
