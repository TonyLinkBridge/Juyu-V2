export function analyticsPercent(numerator:number,denominator:number):string {
 return denominator===0?'—':`${new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(numerator/denominator*100)}%`;
}
