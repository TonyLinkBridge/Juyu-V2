'use client';
export function DirectPublishConfirmation({locale,open,busy,uncertain,confirmDisabled=false,englishQualityConfirmed,onEnglishQualityConfirmedChange,onConfirm,onCancel}:{locale:'zh-CN'|'en';open:boolean;busy:boolean;uncertain:boolean;confirmDisabled?:boolean;englishQualityConfirmed:boolean;onEnglishQualityConfirmedChange:(value:boolean)=>void;onConfirm:()=>void;onCancel:()=>void}){
 if(!open)return null;
 const english=locale==='en';
 return <div className="review-decision-confirm direct-publish-confirmation" role="dialog" aria-modal="true" aria-labelledby="direct-publish-title">
  <h3 id="direct-publish-title">{english?'Approve and publish':'批准并发布'}</h3>
  <p>{english?'The currently saved content will be approved and published directly by your Super Admin account.':'这份当前保存的内容将由你的 Super Admin 账号直接批准并发布。'}</p>
  {english&&<label className="review-english-quality"><input type="checkbox" checked={englishQualityConfirmed} onChange={event=>onEnglishQualityConfirmedChange(event.target.checked)}/><span>I confirm that I reviewed this content for natural, native English.</span></label>}
  <div className="review-decision-actions"><button type="button" disabled={busy||confirmDisabled||english&&!englishQualityConfirmed} onClick={onConfirm}>{busy?(english?'Publishing…':'正在发布…'):uncertain?(english?'Retry the same publication':'重试原发布'):english?'Confirm publication':'确认发布'}</button><button type="button" disabled={busy||uncertain} onClick={onCancel}>{english?'Cancel':'取消'}</button></div>
 </div>;
}
