import 'server-only';
import {redirect} from 'next/navigation';
import {clerkConfiguration} from '../../config/clerk';
import {currentAccountAccess} from '../authentication/account-clerk';
import {developerAccess} from './guard';
import {applicationDevelopers} from './application';
import {DeveloperConsole,type DeveloperSection} from '../../components/developers/DeveloperConsole';
export async function developerPage(section:DeveloperSection){
 if(clerkConfiguration(process.env)!=='configured')redirect('/admin/sign-in');
 const access=await currentAccountAccess();
 if(!developerAccess(access))redirect(access.status==='signed_out'?'/admin/sign-in':access.status==='unavailable'?'/admin/sign-in/error':'/admin/access-denied');
 let unavailable=false,denied=false;
 try{await applicationDevelopers().access();}catch(e){denied=e instanceof Error&&e.message.startsWith('FORBIDDEN');unavailable=true;}
 if(denied)redirect('/admin/access-denied');
 if(unavailable)return <main id="main-content" className="admin-data-main"><h1>开发者工具</h1><p role="alert">暂时无法确认开发者权限，请稍后重新进入。</p><a href="/admin">返回内容管理</a></main>;
 return <DeveloperConsole section={section}/>;
}
