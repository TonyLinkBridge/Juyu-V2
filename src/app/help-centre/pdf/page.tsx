import {applicationAuthorization} from '../../../server/authorization/application';
import {FumadocsPDFPage} from '../../../components/fumadocs/FumadocsPDFPage';
import {redirect} from 'next/navigation';
import {positiveInteger} from '../../../feedback/model';
import {readReaderPresentation} from '../../../server/reader-presentation';
export const dynamic='force-dynamic';
export default async function ArticlePDF({searchParams}:{searchParams:Promise<{article?:string|string[];revision?:string|string[];lang?:string|string[]}>}){
 let snapshot,state:'ready'|'disabled'|'unavailable'='unavailable',error='PDF 暂时无法读取，请稍后重试。';
 const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
 try{const service=await applicationAuthorization(),features=await service.features();if(!features.pdfExport){state='disabled';error=locale==='en'?'PDF export is currently disabled. Contact an administrator if you need it.':'PDF 阅读／导出功能目前已关闭；如需使用，请联系管理员。';}else{if(typeof params.article!=='string'||typeof params.revision!=='string')throw new Error('INVALID_INPUT');snapshot=await service.pdf(params.article,positiveInteger(Number(params.revision)));state='ready';}}
 catch(e){const code=e instanceof Error?e.message:'';if(code==='AUTH_NOT_CONFIGURED')redirect('/sign-in');error=locale==='en'?(code==='VERSION_CHANGED'?'This article has been updated. Open the latest published version.':code==='NOT_FOUND'||code.startsWith('FORBIDDEN')?'This article is unavailable or you do not have access.':'The PDF could not be opened. Please try again later.'):(code==='VERSION_CHANGED'?'文章已更新，请重新打开当前正式版本。':code==='NOT_FOUND'||code.startsWith('FORBIDDEN')?'文章已下线或你没有访问权限。':'PDF 暂时无法读取，请稍后重试。');}
 if(snapshot&&((snapshot.article.locale==='en')!==(params.lang==='en')))redirect(`/help-centre/pdf?article=${encodeURIComponent(snapshot.article.id)}&revision=${snapshot.article.revision}${snapshot.article.locale==='en'?'&lang=en':''}`);
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],search=false;
 try{const presentation=await readReaderPresentation();menu=presentation.items;search=presentation.features.search;}catch{}
 return <FumadocsPDFPage snapshot={snapshot} state={state} message={error} menu={menu} search={search} locale={locale}/>;
}
