export function codeLineNumbers(spec:string|undefined):Set<number>{
 const lines=new Set<number>();
 for(const part of (spec??'').split(',')){
  const match=part.trim().match(/^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/);
  if(!match)continue;
  const start=Number(match[1]),end=Number(match[2]??match[1]);
  if(start<1||end<start||end-start>100)continue;
  for(let line=start;line<=end;line++)lines.add(line);
 }
 return lines;
}
