import 'server-only';
import {redirect} from 'next/navigation';
import {currentAccountAccess} from './account-clerk.ts';

export async function requireReaderAccount(){
 const access=await currentAccountAccess();
 if(access.status==='ready')return access;
 if(access.status==='signed_out'||access.status==='unconfigured')redirect('/sign-in');
 if(access.status==='unavailable')redirect('/sign-in/error');
 redirect('/help-centre');
}
