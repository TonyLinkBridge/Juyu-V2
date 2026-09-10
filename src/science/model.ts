import katex from 'katex';
export function mathMarkup(source:string):string {
 if(!source.trim()||source.length>2000||/[\\](?:href|url|includegraphics|html\w*|def|gdef|edef|xdef)\b/i.test(source))throw new Error('公式不支持链接、HTML或宏定义，长度最多2000字。');
 try{return katex.renderToString(source,{displayMode:true,output:'mathml',throwOnError:true,trust:false,strict:'error',maxExpand:100,maxSize:20});}catch(error){throw new Error((error instanceof Error?error.message:'公式格式错误').slice(0,350));}
}
export function validateDiagram(source:string):string {
 if(!source.trim()||source.length>4000||!/^\s*(?:flowchart|graph)\s+(?:TD|TB|BT|LR|RL)\b/.test(source))throw new Error('请以 flowchart TD 或 flowchart LR 开头，最多4000字。');
 if(/%%\{|^\s*---|\b(?:click|style|classDef|linkStyle)\b|<|>|https?:|javascript:|data:|@\{|\$\$/im.test(source.replace(/-->|==>|-\.->/g,'')))throw new Error('流程图不支持外链、点击、HTML、自定义样式或配置。');
 return source;
}
