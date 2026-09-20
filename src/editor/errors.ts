/** Only public error codes cross the editor boundary; never show raw server errors. */
export function saveError(code:string):string {
 const messages:Record<string,string>={
  INVALID_TITLE:'标题或问题为空、过长或包含不支持的字符。请检查后再保存。',
  INVALID_BODY:'正文格式或长度不符合要求。请检查最近插入的内容；当前输入仍保留。',
  INVALID_QA:'问答分类或排序不符合要求。分类最多 80 字，排序须为 0 至 999999 的整数。',
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

export function validationError(code:string):string {
 const messages:Record<string,string>={
  INVALID_QA:'问答排序须为 0 至 999999 的整数；请检查问答分类与排序。',
  INVALID_FIELDS:'自定义字段的必填项、类型或选项不正确；请打开文章设置核对。',
  INVALID_CATEGORY:'文章分类无效或已停用；请重新选择分类。',
  INVALID_PRESENTATION:'标签或封面设置不符合要求；请打开文章设置核对。',
  INVALID_BODY:'正文格式或长度超出限制；请检查最近插入的内容。',
  PRIVATE_EDITOR_FILE_REQUIRED:'图片、影片、音频和附件请先上传到本资料库；外部网址可作为文字链接。',
 };
 return `${messages[code]??'当前输入不符合保存规则，请检查最近修改的项目。'}当前输入已保留。`;
}
