import type {TextBlock} from '../../../media/model';
import {CopyCodeButton} from './CopyCodeButton';
// GitBook code header / copy action / preformatted body, with literal safe text.
export function CodeBlock({block}:{block:Extract<TextBlock,{type:'code'}>}){
 return <section className="rich-code" aria-label="代码框"><div className="rich-code-header"><span>{block.language||'纯文本'}</span><CopyCodeButton key={block.code} code={block.code}/></div><pre role="region" tabIndex={0} aria-label="代码内容，可横向滚动"><code>{block.code}</code></pre></section>;
}
