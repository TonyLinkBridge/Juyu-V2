export const featureKeys=['search','pdfExport','favorites','recent','feedback','analytics','forms'] as const;
export type FeatureKey=typeof featureKeys[number];
export type FeatureFlags=Record<FeatureKey,boolean>;
export interface FeatureConfig {version:number;flags:FeatureFlags}
export interface FeatureWrite {expectedVersion:number;flags:FeatureFlags}
export const defaultFeatureFlags:FeatureFlags={search:true,pdfExport:true,favorites:true,recent:true,feedback:true,analytics:true,forms:true};
export const closedFeatureFlags:FeatureFlags={search:false,pdfExport:false,favorites:false,recent:false,feedback:false,analytics:false,forms:false};
export const featureLabels:Record<FeatureKey,string>={search:'资料搜索',pdfExport:'文章 PDF 阅读／导出',favorites:'个人收藏',recent:'最近浏览',feedback:'文章反馈',analytics:'使用分析',forms:'内部表单'};
export const featureDescriptions:Record<FeatureKey,string>={search:'关闭搜索框和搜索请求，文章仍按原权限阅读。',pdfExport:'关闭应用内文章 PDF 阅读与生成；原始附件下载和浏览器自带打印仍可使用。',favorites:'暂停收藏列表与收藏操作；原有收藏保留。',recent:'暂停记录和查看最近浏览；原有记录保留。',feedback:'暂停员工反馈及后台反馈列表；原有反馈保留。',analytics:'暂停浏览、搜索及点击分析采集和后台分析；原有数据保留，重新开启不会补采暂停期间事件。',forms:'暂停表单填写、配置、提交记录与处理；表单和旧提交保留。'};
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');return value as Record<string,unknown>;}
export function normalizeFeatureFlags(value:unknown):FeatureFlags{const x=record(value);if(Object.keys(x).length!==featureKeys.length||featureKeys.some(k=>typeof x[k]!=='boolean'))throw new Error('INVALID_INPUT');return Object.fromEntries(featureKeys.map(k=>[k,x[k]])) as FeatureFlags;}
function version(n:unknown){if(!Number.isSafeInteger(n)||Number(n)<0||Number(n)>=2147483647)throw new Error('INVALID_INPUT');return Number(n);}
export function normalizeFeatureConfig(value:unknown):FeatureConfig{const x=record(value);if(Object.keys(x).length!==2||!Object.hasOwn(x,'version')||!Object.hasOwn(x,'flags'))throw new Error('INVALID_INPUT');return {version:version(x.version),flags:normalizeFeatureFlags(x.flags)};}
export function parseFeatureWrite(value:unknown):FeatureWrite{const x=record(value);if(Object.keys(x).length!==2||!Object.hasOwn(x,'expectedVersion')||!Object.hasOwn(x,'flags'))throw new Error('INVALID_INPUT');return {expectedVersion:version(x.expectedVersion),flags:normalizeFeatureFlags(x.flags)};}
