import {FeatureSearch} from '../../../components/features/FeatureSearch';
import {FeaturePage} from '../../../components/features/FeaturePage';
import {ReaderMenu} from '../../../components/navigation-settings/ReaderMenu';
import {applicationAuthorization} from '../../../server/authorization/application';
import {PDFPage} from '../../../components/gitbook/PDF/PDFPage';
import {EntryShell} from '../../../components/entry-shell';
import {redirect} from 'next/navigation';
import {positiveInteger} from '../../../feedback/model';
export const dynamic='force-dynamic';
export default async function ArticlePDF({searchParams}:{searchParams:Promise<{article?:string|string[];revision?:string|string[];lang?:string|string[]}>}){
 let snapshot;let error='PDF 暂时无法读取';
 const params=await searchParams,locale=params.lang==='en'?'en':'zh-CN';
 try{const service=await applicationAuthorization();if(typeof params.article!=='string'||typeof params.revision!=='string')throw new Error('INVALID_INPUT');snapshot=await service.pdf(params.article,positiveInteger(Number(params.revision)));}
 catch(e){const code=e instanceof Error?e.message:'';if(code==='AUTH_NOT_CONFIGURED')redirect('/sign-in');error=locale==='en'?(code==='VERSION_CHANGED'?'This article has been updated. Open the latest published version.':code==='NOT_FOUND'||code.startsWith('FORBIDDEN')?'This article is unavailable or you do not have access.':'The PDF could not be opened. Please try again later.'):(code==='VERSION_CHANGED'?'文章已更新，请重新打开当前正式版本。':code==='NOT_FOUND'||code.startsWith('FORBIDDEN')?'文章已下线或你没有访问权限。':'PDF 暂时无法读取，请稍后重试。');}
 if(snapshot&&((snapshot.article.locale==='en')!==(params.lang==='en')))redirect(`/help-centre/pdf?article=${encodeURIComponent(snapshot.article.id)}&revision=${snapshot.article.revision}${snapshot.article.locale==='en'?'&lang=en':''}`);
 return <FeaturePage feature="pdfExport" locale={locale}><EntryShell account search={<FeatureSearch/>} navigation={snapshot?<ReaderMenu/>:undefined}>{snapshot?<PDFPage snapshot={snapshot}/>:<main id="main-content" className="members-main"><h1>{locale==='en'?'PDF preview':'PDF 阅读'}</h1><p role="status">{error}</p><a className="secondary-link" href={locale==='en'?'/help-centre?lang=en':'/help-centre'}>{locale==='en'?'Back to Help Centre':'返回资料库'}</a></main>}</EntryShell></FeaturePage>;
}
