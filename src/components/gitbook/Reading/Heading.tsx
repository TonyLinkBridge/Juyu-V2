import {Inline} from './Inline';
// Adapted from GitBook DocumentView/Heading.tsx (GPL-3.0).
// Keep heading-level mapping, anchor, text span and direct heading link.
import type {ReaderBlock} from '../../../reader/body';
const TAGS={1:'h2',2:'h3',3:'h4'} as const;
export function Heading({block,locale='zh-CN'}:{block:Extract<ReaderBlock,{type:'heading'}>;locale?:'zh-CN'|'en'}) {
 const Tag=TAGS[block.depth];
 return <Tag id={block.id} tabIndex={-1} className="heading font-heading block gitbook-heading">
   <span className="max-w-full break-words">{<Inline text={block.text}/>}</span>
   <a href={`#${block.id}`} className="heading-hash" aria-label={locale==='en'?`Jump to ${block.text}`:`定位到：${block.text}`}>#</a>
 </Tag>;
}
