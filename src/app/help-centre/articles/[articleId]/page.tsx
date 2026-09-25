import {redirect} from 'next/navigation';
import {FumadocsAuthorizedPublication} from '../../../../components/fumadocs/FumadocsAuthorizedPublication';
import {clerkConfiguration} from '../../../../config/clerk';
import {employeeCompanyAccess} from '../../../../server/authentication/company-clerk';
import {applicationEnrollment} from '../../../../server/enrollment/application';
import {bindCurrentMember} from '../../../../server/members/entry';

export const dynamic='force-dynamic';

export default async function FormalArticle({params}:{params:Promise<{articleId:string}>}){
 const access=await employeeCompanyAccess();
 if(access.status==='signed_out'||clerkConfiguration(process.env)!=='configured')redirect('/sign-in');
 if(access.status==='unavailable')redirect('/sign-in/error');
 if(access.status!=='verified')redirect('/help-centre');
 let ready=false;
 try{if((await(await applicationEnrollment()).inspect()).status==='ready'){await bindCurrentMember();ready=true;}}catch{}
 if(!ready)redirect('/help-centre');
 const {articleId}=await params;
 return <FumadocsAuthorizedPublication articleId={articleId} mode="formal"/>;
}
