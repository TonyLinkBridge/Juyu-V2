import {FumadocsAuthorizedPublication} from '../../../../components/fumadocs/FumadocsAuthorizedPublication';

export const dynamic='force-dynamic';

export default async function FumadocsPublicationPreview({params}:{params:Promise<{articleId:string}>}){
 const {articleId}=await params;
 return <FumadocsAuthorizedPublication articleId={articleId}/>;
}
