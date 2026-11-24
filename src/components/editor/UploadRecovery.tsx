'use client';
export interface FailedEditorUpload {blockId:string;file:File;code:string}
export function UploadRecovery({items,disabled,locale,onRetry,onDiscard}:{items:FailedEditorUpload[];disabled:boolean;locale:'zh-CN'|'en';onRetry:(item:FailedEditorUpload)=>void;onDiscard:(blockId:string)=>void}){
 if(!items.length)return null;
 const t=(zh:string,en:string)=>locale==='en'?en:zh;
 return <section className="editor-upload-recovery" aria-label={t('上传失败的文件','Failed uploads')}>
  <strong>{t('有文件未上传成功','Some files could not be uploaded')}</strong>
  <ul>{items.map(item=><li key={item.blockId}>
   <div><strong>{item.file.name}</strong><p>{item.code==='UPLOAD_TOO_LARGE'?t('文件超过服务器接收限制，请压缩后重新选择。','The file exceeds the server limit. Choose a smaller file.'):item.code==='UPLOAD_BUSY'?t('同时上传的文件较多，请稍后重试。','Too many files are uploading. Try again shortly.'):item.code==='INVALID_UPLOAD'?t('文件格式或大小不符合要求，请重新选择支持的文件。','The file type or size is not supported. Choose another file.'):item.code==='SAVE_DRAFT_FIRST'?t('请先填写标题并保存草稿，再重试上传。','Add a title and save the draft, then retry.'):t('上传结果未确认。可先核对附件列表；重试会重新上传此文件。','The upload is unconfirmed. Check the attachment list first; retrying uploads the file again.')}</p></div>
   <div className="editor-upload-recovery-actions"><button type="button" disabled={disabled} onClick={()=>onRetry(item)}>{t('重试上传','Retry upload')}</button><button type="button" disabled={disabled} onClick={()=>onDiscard(item.blockId)}>{t('删除占位','Remove placeholder')}</button></div>
  </li>)}</ul>
  <p>{t('删除占位只移除这次未完成的插入，不会删除已有附件或正式版。','Removing a placeholder keeps existing attachments and published versions.')}</p>
 </section>;
}
