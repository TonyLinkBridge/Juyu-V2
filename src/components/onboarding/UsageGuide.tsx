"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useRouter} from 'next/navigation';
import {X} from 'lucide-react';
import {Onboarding,TipsList} from '../ui/onboarding';
import {normalizeFeatureFlags,type FeatureFlags} from '../../features/model';
import {requestReviewLeave} from '../../review/leave';
import styles from './usage-guide.module.css';
export type AdminGuideRole='admin'|'super_admin';
interface SaveProps {saving?:boolean;saveFailed?:boolean;onRetrySave?:()=>Promise<boolean>;onDismiss?:()=>void;}
interface Props extends SaveProps {admin?:boolean;adminRole?:AdminGuideRole|null;locale?:'zh-CN'|'en';onClose:()=>void|boolean|Promise<void|boolean>;onComplete?:()=>void|boolean|Promise<void|boolean>;}
interface GuideStep {title:string;description:string;tips:string[];link?:{href:string;label:string};}
/** Real role/feature mapping is consumer content; the multi-step UI is Cult's official component. */
export function UsageGuide({admin=false,adminRole=null,locale='zh-CN',onClose,...lifecycle}:Props){
 const [flags,setFlags]=useState<FeatureFlags|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let active=true;const timer=setTimeout(()=>controller.abort(),10000);
  void fetch('/api/features',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('FEATURE_UNAVAILABLE');const value=await response.json();const next=normalizeFeatureFlags(value.flags);if(active)setFlags(next);}).catch(()=>{if(active)setFailed(true);}).finally(()=>clearTimeout(timer));
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[retry]);
 return <GuideDialog admin={admin} adminRole={adminRole} locale={locale} flags={flags} failed={failed} onRetry={()=>{setFailed(false);setFlags(null);setRetry(n=>n+1);}} onClose={onClose} {...lifecycle}/>;
}
/** Also used by development-only previews with explicitly labelled fixture features. */
export function GuideDialog({admin=false,adminRole=null,locale='zh-CN',flags,failed=false,onRetry,onClose,onComplete,saving=false,saveFailed=false,onRetrySave,onDismiss}:Props&{flags:FeatureFlags|null;failed?:boolean;onRetry?:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null),id=useId(),router=useRouter();
 const [step,setStep]=useState(1);const t=(zh:string,en:string)=>locale==='en'?en:zh;
 useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
 useEffect(()=>{if(step>1)heading.current?.focus();},[step]);
 const title=admin?t('后台使用指南','Admin usage guide'):t('员工使用指南','Employee usage guide');
 const lang=locale==='en'?'?lang=en':'';
 const steps:GuideStep[]=admin?[
  {title:t('筛选与管理资料','Find and manage content'),description:t('在后台查看真实工作版本和处理状态。','Use the content workspace to find drafts and their current status.'),tips:[t('先选知识文章、OPS、Reference 或 Q&A，再按标题和内容状态筛选。','Choose knowledge articles, OPS, Reference or Q&A, then filter by title and status.'),t('「我提交的」「待我审核」「退回给我的」对应当前账号的工作。','Submitted by me, Assigned to me and Returned to me show work associated with your account.'),t('已有正式版的文章即使正在修订，员工仍可阅读旧正式版。','Readers can still access the published version while a new draft is being edited.')],link:{href:'/admin',label:t('打开内容管理','Open content workspace')}},
  {title:t('编辑与自动保存','Edit and save drafts'),description:t('写内容前先给文章起标题，修改后检查保存状态。','Start with a title, then check the save status as you work.'),tips:[t('在正文输入「/」添加文字、标题、列表等内容；右侧「内容插入」添加提示框或分页标签。','Type / in the editor for text, headings and lists. Use Content insert for callouts and tabs.'),t('在「文章设置」管理分类、阅读权限、封面和附件；等到显示「所有修改已保存」再继续发布。','Article settings hold categories, access, cover images and attachments. Wait for All changes saved before publishing.'),t('保存遇到问题时，先用「复制当前输入」保留完整草稿，再按页面提示恢复。','If saving fails, use Copy current input to keep the full draft, then follow the recovery instructions.')]},
  {title:t('二审与发布','Review and publish'),description:t('指南只解释流程，不会替你提交或发布。','This guide explains the workflow without submitting or publishing anything.'),tips:adminRole==='super_admin'?[t('你可以提交二审，也可以在编辑页使用「批准并发布」。','You can submit for review or use Approve and publish in the editor.'),t('只有「批准并发布」可点击时才可继续；检查保存和附件状态，并在确认窗口再次确认。','Proceed only when Approve and publish is enabled. Check saving and attachments, then confirm the publication.'),t('发布成功后再打开员工资料库核对正式版本。','After publication succeeds, check the published version in the employee library.')]:[t('保存后点击「提交二审」，按页面要求指定二审人。','Save, then choose Submit for review and assign a reviewer as prompted.'),t('在「待我审核」处理指派给你的资料；通过后按页面显示的权限和状态继续发布。','Review content assigned to you. After approval, follow the available actions and status to publish.'),t('被退回的文章先按原因修改并保存，再重新提交二审。','For returned content, make the requested changes, save, then submit for review again.')]}
 ]:flags?[
  {title:t('按分类找资料','Browse by category'),description:t('从资料库入口进入知识文章、速查资料或问答。','Start with knowledge articles, reference guides or Q&A in the library.'),tips:[t('通过目录分类找到相关资料；你只会看到当前账号有权阅读的正式版本。','Use categories to find published content that your account can access.'),t('找不到资料时先确认分类和账号权限，再联系管理员。','If something is missing, check the category and your access, then contact an administrator.')],link:{href:'/help-centre/library'+lang,label:t('打开资料目录','Open library')}},
  ...(flags.search?[{title:t('搜索资料','Search for answers'),description:t('用问题中的关键词搜索，结果仍按你的阅读权限显示。','Search with keywords from your question. Results follow your reading permissions.'),tips:[t('先搜具体关键词，例如「域名转入」或「登录验证」。','Start with specific keywords, such as domain transfer or login verification.'),t('结果不合适时换一个关键词，或回到分类目录查找。','Try a different keyword or browse categories if the results are not useful.')],link:{href:'/help-centre/search'+lang,label:t('打开资料搜索','Open search')}}]:[]),
  {title:t('阅读正式资料','Read published content'),description:t('打开文章后，按目录或正文步骤查阅。','Follow the article headings and instructions.'),tips:[t('以文章当前正式版为准，遇到不明确的步骤请向负责人确认。','Use the current published version. Ask the owner if a step is unclear.'),...(flags.favorites?[t('常用文章可加入收藏，之后从收藏入口快速打开。','Save frequently used articles to Favorites for quick access.')]:[]),...(flags.feedback?[t('文章下方可以反馈资料是否有帮助，或说明哪里需要改进。','Use article feedback to say whether the content helped or what needs improvement.')]:[])]}
 ]:[];
 const inaccessible=admin&&!adminRole;
 return typeof document==='undefined'?null:createPortal(<dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={event=>{event.preventDefault();void onClose();}}>
  <div className={styles.top}><h2 id={id}>{title}</h2><button type="button" aria-label={t('关闭使用指南','Close guide')} disabled={saving} onClick={()=>void onClose()}><X size={20} aria-hidden="true"/></button></div>
  <div className={styles.body}>
   {failed||inaccessible?<><p role="alert">{t('暂时无法读取当前功能，请重试。','Your current features could not be loaded. Try again.')}</p>{onRetry&&!inaccessible&&<button className={styles.retry} type="button" onClick={onRetry}>{t('重新读取','Try again')}</button>}</>:!flags?<p role="status">{t('正在读取当前功能…','Loading your current features…')}</p>:<fieldset className={styles.controls} disabled={saving}><Onboarding totalSteps={steps.length} value={step} onValueChange={setStep} onComplete={()=>void (onComplete||onClose)()}>
    <Onboarding.StepIndicator aria-label={t(`第 ${step} 步，共 ${steps.length} 步`,`Step ${step} of ${steps.length}`)}/>
    {steps.map((item,index)=><Onboarding.Step step={index+1} key={item.title}>
     <Onboarding.Header><h2 ref={step===index+1?heading:undefined} tabIndex={-1}>{item.title}</h2><p>{item.description}</p></Onboarding.Header>
     <TipsList title={t('操作提示','Tips')}>{item.tips.map((tip,i)=><TipsList.Item key={tip} number={i+1}>{tip}</TipsList.Item>)}</TipsList>
     {item.link&&<a className={styles.link} href={item.link.href} aria-disabled={saving||undefined} onClick={async event=>{if(saving){event.preventDefault();return;}if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(admin&&!await requestReviewLeave('navigate'))return;if(await onClose()===false)return;router.push(item.link!.href);}}>{item.link.label} ↗</a>}
    </Onboarding.Step>)}
    <Onboarding.Navigation aria-label={t('指南步骤','Guide navigation')} backLabel={t('上一步','Back')} nextLabel={t('下一步','Next')} completeLabel={t('开始使用','Get started')}/>
   </Onboarding></fieldset>}
   <GuideSaveNotice locale={locale} saving={saving} saveFailed={saveFailed} onRetrySave={onRetrySave} onDismiss={onDismiss}/>
  </div>
 </dialog>,document.body);
}

function GuideSaveNotice({locale='zh-CN',saving,saveFailed,onRetrySave,onDismiss}:SaveProps&{locale?:'zh-CN'|'en'}){
 const t=(zh:string,en:string)=>locale==='en'?en:zh;
 if(saving)return <p className={styles.saveStatus} role="status">{t('正在保存引导状态…','Saving your guide preferences…')}</p>;
 if(!saveFailed)return null;
 return <div className={styles.saveNotice}><p role="alert">{t('未能保存引导状态，请重试。也可以本次先关闭；换设备后可能会再次提醒。','Your guide preferences could not be saved. Retry, or dismiss for this tab; the reminder may appear on another device.')}</p><div className={styles.actions}><button type="button" onClick={()=>void onRetrySave?.()}>{t('重试保存','Retry saving')}</button><button type="button" onClick={onDismiss}>{t('本次先关闭','Dismiss for this tab')}</button></div></div>;
}
export function GuideWelcome({admin=false,locale='zh-CN',onStart,onSkip,...save}:SaveProps&{admin?:boolean;locale?:'zh-CN'|'en';onStart:()=>void;onSkip:()=>Promise<boolean>}){
 const t=(zh:string,en:string)=>locale==='en'?en:zh;
 return typeof document==='undefined'?null:createPortal(<aside className={styles.welcome} role="region" aria-label={admin?t('后台新手引导','Admin onboarding'):t('员工新手引导','Employee onboarding')}>
  <p className={styles.eyebrow}>{admin?t('后台使用指南','Admin usage guide'):t('员工使用指南','Employee usage guide')}</p>
  <h2>{t('欢迎使用 JUYU 知识库','Welcome to the JUYU Knowledge Hub')}</h2>
  <p>{admin?t('花一分钟了解资料管理、编辑保存和审核发布。','Take a minute to learn how to manage content, save drafts, and review and publish.'):t('花一分钟了解怎样找资料、搜索答案和阅读正式内容。','Take a minute to learn how to find content, search for answers and read published guidance.')}</p>
  <p className={styles.hint}>{t('以后也可以从头像菜单的「使用指南」重新查看。','You can revisit the usage guide from your account menu at any time.')}</p>
  <div className={styles.actions}><button type="button" disabled={save.saving} onClick={onStart}>{t('开始引导','Start guide')}</button><button type="button" disabled={save.saving} onClick={()=>void onSkip()}>{t('暂时跳过','Skip for now')}</button></div>
  <GuideSaveNotice locale={locale} {...save}/>
 </aside>,document.body);
}
