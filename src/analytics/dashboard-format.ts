export function analyticsPercent(numerator:number,denominator:number):string {
 return denominator===0?'—':`${new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(numerator/denominator*100)}%`;
}
export function visibleDuration(milliseconds:number|null|undefined):string{
 if(milliseconds==null)return '未记录';const seconds=Math.max(0,Math.round(milliseconds/1000));if(seconds<60)return `${seconds}秒`;const minutes=Math.floor(seconds/60);return `${minutes}分${seconds%60?`${seconds%60}秒`:''}`;
}
