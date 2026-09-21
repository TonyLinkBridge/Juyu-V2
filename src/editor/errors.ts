/** Only public error codes cross the editor boundary; never show raw server errors. */
export function saveError(code:string,locale:'zh-CN'|'en'='zh-CN'):string {
 if(locale==='en'){
  const messages:Record<string,string>={
   INVALID_TITLE:'Add a title or question, then check its length and characters.',
   INVALID_DESCRIPTION:'Keep the short description under 300 characters and on one line.',
   INVALID_RELEASE_NOTE:'Keep the update note under 600 characters and remove unsupported characters.',
   INVALID_BODY:'Check the format or length of the content you just added.',
   INVALID_QA:'Check the Q&A category, use no more than 5 related topics, and use a whole number from 0 to 999999 for its order.',
   INVALID_CATEGORY:'Choose up to 20 valid categories without duplicates.',
   INVALID_FIELDS:'Check the required custom fields and their values in article settings.',
   INVALID_MEDIA:'An image or attachment is unavailable or belongs to another article. Upload it here again.',
   INVALID_COVER:'Choose an available cover image uploaded to this article.',
   INVALID_PRESENTATION:'Check the tags and cover settings.',
   INVALID_INPUT:'The server rejected one or more fields. Keep this page open and check your latest changes.',
   FIELD_CONFLICT:'Custom field settings changed. Copy a backup, then compare with the latest server version.',
   CONFLICT:'Another admin or tab saved this article. Compare with the latest server version before trying again.',
   INVALID_STATE:'This article is in review. Load its latest status before editing.',
   INACTIVE_DOCUMENT:'This article is inactive. Load its latest status before editing.',
   FORBIDDEN:'Your access changed. Ask an admin to check your permissions.',
   NOT_FOUND:'This article was not found. Keep your input and check whether it was deleted.',
   USE_EDITOR:'Open this article in the editor to make this change.',
   UPLOAD_TOO_LARGE:'Reduce the size of the content or file before trying again.',
   AUTH_NOT_CONFIGURED:'Sign-in or database access is not configured. Contact an administrator.',
   EDITOR_UNAVAILABLE:'The save service is unavailable. Keep your input and check the latest version before retrying.',
   INVALID_ACK:'The server response could not confirm the save. Load the latest version before trying again.',
   NETWORK_ERROR:'The connection dropped or timed out. Keep your input and check the latest version before retrying.',
   UNRECOGNIZED_RESPONSE:'The server did not explain the error. Keep your input and ask an admin to check the request.',
  };
  return `Save not confirmed: ${messages[code]??'An unknown error occurred. Keep your input and ask an admin to check the request.'}`;
 }
 const messages:Record<string,string>={
  INVALID_TITLE:'标题或问题为空、过长或包含不支持的字符。请检查后再保存。',
  INVALID_DESCRIPTION:'文章简介最多 300 字，不能包含换行或控制字符。请检查后再保存。',
  INVALID_RELEASE_NOTE:'更新说明最多 600 字，不能包含异常控制字符。请打开文章设置检查。',
  INVALID_BODY:'正文格式或长度不符合要求。请检查最近插入的内容；当前输入仍保留。',
  INVALID_QA:'问答设置不符合要求。主要分类最多 80 字，相关话题最多 5 个，排序须为 0 至 999999 的整数。',
  INVALID_CATEGORY:'所选文章分类无效、重复或超过 20 项。请重新选择分类。',
  INVALID_FIELDS:'自定义字段的数据格式不正确。请打开文章设置检查字段。',
  INVALID_MEDIA:'正文中的图片或附件不可用，或不属于这篇资料。请重新上传并插入该文件。',
  INVALID_COVER:'所选封面不可用，或不属于这篇资料。请重新选择本篇已上传的图片。',
  INVALID_PRESENTATION:'标签或封面设置不符合要求。请检查标签数量、长度和封面位置。',
  INVALID_INPUT:'提交内容有不符合规则的项目，服务器无法确认具体字段。请保留输入并检查最近改动。',
  FIELD_CONFLICT:'字段设置已更新。请先复制备份，再读取服务器最新版本核对字段。',
  CONFLICT:'另一位管理员或另一个页面已保存修改。请先对照服务器最新版本；不会覆盖服务器版本。',
  INVALID_STATE:'这篇资料正在审核，暂时不能保存草稿。请读取最新状态。',
  INACTIVE_DOCUMENT:'这篇资料已停用，暂时不能编辑。请读取最新状态。',
  FORBIDDEN:'你的管理权限已改变，当前不能保存。请联系管理员核对权限。',
  NOT_FOUND:'服务器找不到这篇资料。请保留输入并核对资料是否已删除。',
  USE_EDITOR:'这项修改需要从编辑器提交。请保留输入并重新打开编辑页。',
  UPLOAD_TOO_LARGE:'本次提交超过允许大小。请缩减正文或文件后重试。',
  AUTH_NOT_CONFIGURED:'登录或数据库服务尚未配置完成。请联系系统管理员。',
  EDITOR_UNAVAILABLE:'保存服务器暂时不可用。请保留输入，稍后读取服务器最新版本再重试。',
  INVALID_ACK:'服务器回执无法核对，保存结果未知。请先读取服务器最新版本，避免重复覆盖。',
  NETWORK_ERROR:'网络连接中断或请求超时。请保留输入，先核对服务器最新版本再重试。',
  UNRECOGNIZED_RESPONSE:'服务器没有提供可识别的错误原因。请保留输入并联系管理员核对请求记录。',
 };
 return `保存尚未确认：${messages[code]??'出现未识别的保存错误。请保留输入并联系管理员核对请求记录。'}`;
}

export function validationError(code:string,locale:'zh-CN'|'en'='zh-CN'):string {
 if(locale==='en'){
  const messages:Record<string,string>={
   INVALID_QA:'Use no more than 5 related topics and a whole number from 0 to 999999 for the Q&A order.',
   INVALID_DESCRIPTION:'Keep the short description under 300 characters and on one line.',
   INVALID_RELEASE_NOTE:'Keep the update note under 600 characters and remove unsupported characters.',
   INVALID_FIELDS:'Check the required custom fields and their values in article settings.',
   INVALID_CATEGORY:'Choose an active category.',
   INVALID_PRESENTATION:'Check the tags and cover settings in article settings.',
   INVALID_BODY:'Check the format or length of the content you just added.',
   PRIVATE_EDITOR_FILE_REQUIRED:'Upload images and attachments to this article first. External URLs can be text links.',
  };
  return `${messages[code]??'Check the content you just changed.'} Your input is still here.`;
 }
 const messages:Record<string,string>={
  INVALID_QA:'相关话题最多 5 个，问答排序须为 0 至 999999 的整数；请检查问答设置。',
  INVALID_DESCRIPTION:'文章简介最多 300 字，且不能换行。请检查简介。',
  INVALID_RELEASE_NOTE:'更新说明最多 600 字，不能包含异常控制字符；请打开文章设置检查。',
  INVALID_FIELDS:'自定义字段的必填项、类型或选项不正确；请打开文章设置核对。',
  INVALID_CATEGORY:'文章分类无效或已停用；请重新选择分类。',
  INVALID_PRESENTATION:'标签或封面设置不符合要求；请打开文章设置核对。',
  INVALID_BODY:'正文格式或长度超出限制；请检查最近插入的内容。',
  PRIVATE_EDITOR_FILE_REQUIRED:'图片、影片、音频和附件请先上传到本资料库；外部网址可作为文字链接。',
 };
 return `${messages[code]??'当前输入不符合保存规则，请检查最近修改的项目。'}当前输入已保留。`;
}
