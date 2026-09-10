import {FeaturePage} from '../../../components/features/FeaturePage';
import {ReaderMenu} from '../../../components/navigation-settings/ReaderMenu';
import {applicationAuthorization} from '../../../server/authorization/application';
import {PDFPage} from '../../../components/gitbook/PDF/PDFPage';
import {EntryShell} from '../../../components/entry-shell';
import {redirect} from 'next/navigation';
import {positiveInteger} from '../../../feedback/model';
export const dynamic='force-dynamic';
export default async function ArticlePDF({searchParams}:{searchParams:Promise<{article?:string|string[];revision?:string|string[]}>}){
 let snapshot;let error='PDF 暂时无法读取';
 try{const service=await applicationAuthorization();const params=await searchParams;if(typeof params.article!=='string'||typeof params.revision!=='string')throw new Error('INVALID_INPUT');snapshot=await service.pdf(params.article,positiveInteger(Number(params.revision)));}
 catch(e){const code=e instanceof Error?e.message:'';if(code==='AUTH_NOT_CONFIGURED')redirect('/sign-in');error=code==='VERSION_CHANGED'?'文章已更新，请重新打开当前正式版本。':code==='NOT_FOUND'||code.startsWith('FORBIDDEN')?'文章已下线或你没有访问权限。':'PDF 暂时无法读取，请稍后重试。';}
 return <FeaturePage feature="pdfExport"><EntryShell navigation={snapshot?<ReaderMenu/>:undefined}>{snapshot?<PDFPage snapshot={snapshot}/>:<main id="main-content" className="members-main"><h1>PDF 阅读</h1><p role="status">{error}</p><a className="secondary-link" href="/help-centre">返回资料库</a></main>}</EntryShell></FeaturePage>;
}
