import {FumadocsAuthorizedPublication} from '../../../../components/fumadocs/FumadocsAuthorizedPublication';
import {requireReaderAccount} from '../../../../server/authentication/navigation';

export const dynamic='force-dynamic';

export default async function FormalArticle({params}:{params:Promise<{articleId:string}>}){
 await requireReaderAccount();
 const {articleId}=await params;
 return <FumadocsAuthorizedPublication articleId={articleId} mode="formal" routeSection="article"/>;
}
