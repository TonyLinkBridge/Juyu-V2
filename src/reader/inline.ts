type Token={type:'text'|'strong'|'em'|'code';text:string};
export function inlineTokens(text:string):Token[]{
 if(/^\s*(`{3,}|~{3,})/.test(text))return [{type:'text',text}];
 const out:Token[]=[];const re=/(`+)([^`\n]+)\1|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;let end=0;
 for(const m of text.matchAll(re)){if(m.index!>end)out.push({type:'text',text:text.slice(end,m.index)});out.push({type:m[2]?'code':m[3]||m[4]?'strong':'em',text:m[2]??m[3]??m[4]??m[5]??m[6]});end=m.index!+m[0].length;}if(end<text.length)out.push({type:'text',text:text.slice(end)});return out;
}
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function inlineHTML(text:string):string{return inlineTokens(text).map(t=>t.type==='text'?escape(t.text):`<${t.type}>${escape(t.text)}</${t.type}>`).join('');}
