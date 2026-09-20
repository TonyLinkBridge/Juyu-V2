import type {PDFSnapshot} from '../../../pdf/model';
import {pdfContent,pdfCSS} from '../../../pdf/render';
import {PDFPrintControls} from './PDFPrintControls';
// Adapted from GitBook PDFPage: separate white print sheet and external controls.
export function PDFPage({snapshot}:{snapshot:PDFSnapshot}){
 const {article,files}=snapshot;
 const cover=article.cover?`/api/assets/${article.cover.assetId}`:undefined;
 const english=article.locale==='en';
 return <main id="main-content" className="pdf-shell"><style>{pdfCSS}</style><PDFPrintControls publicationNumber={article.publicationNumber} locale={article.locale} key={`${article.id}:${article.revision}`} documentId={article.id} revision={article.revision} coverId={article.cover?.assetId??null}/>
  {files.length>0&&<section className="pdf-controls" aria-label={english?'Attached PDFs':'本篇 PDF 文件'}><h2>{english?'Attached PDFs':'本篇 PDF 文件'}</h2><p>{english?'Attachments open separately and are not merged into the article export. If the preview does not appear on mobile, use “Open file”.':'附件单独阅读，不会自动合并到文章导出中。手机如未显示预览，请使用“打开文件”。'}</p><ul>{files.map(file=><li key={file.id}><details><summary>{file.filename}</summary><a href={`/api/assets/${file.id}`} target="_blank" rel="noopener noreferrer">{english?'Open file: ':'打开文件：'}{file.filename}</a><iframe loading="lazy" title={`${english?'PDF':'PDF'}: ${file.filename}`} src={`/api/assets/${file.id}`} className="pdf-file-frame"/></details></li>)}</ul></section>}
  <article className="pdf-paper" aria-label={english?'Article PDF':'PDF 正文'} dangerouslySetInnerHTML={{__html:pdfContent(article,cover)}}/>
 </main>;
}
