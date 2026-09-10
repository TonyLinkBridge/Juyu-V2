import {inlineTokens} from '../../../reader/inline';
export function Inline({text}:{text:string}){return <>{inlineTokens(text).map((t,i)=>t.type==='text'?t.text:t.type==='strong'?<strong key={i}>{t.text}</strong>:t.type==='em'?<em key={i}>{t.text}</em>:<code key={i}>{t.text}</code>)}</>;}
