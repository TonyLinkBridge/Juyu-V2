export const readerIconLabels={book:'书本',users:'成员',shield:'安全',leaf:'入门',currency:'费用',plug:'集成',chat:'问答',file:'文件',globe:'网站',list:'清单',lightbulb:'提示'} as const;
export type ReaderIconKey=keyof typeof readerIconLabels;
export function readerIconKey(value:unknown):ReaderIconKey|null {
 return typeof value==='string'&&Object.hasOwn(readerIconLabels,value)?value as ReaderIconKey:null;
}
