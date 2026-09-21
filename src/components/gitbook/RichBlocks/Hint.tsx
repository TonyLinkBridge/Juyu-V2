import type {ReactNode} from 'react';
import {hintLabels,type TextBlock} from '../../../media/model';
import {ReaderIcon} from '../../../reader/icons';
// GitBook-style semantic hint. Native child blocks retain authored formatting and links.
export function Hint({block,children}:{block:Extract<TextBlock,{type:'hint'}>;children?:ReactNode}){
 const hasHeading=block.showTitle!==false&&Boolean(block.title.trim());
 return <aside className={`rich-hint rich-hint-${block.style}${hasHeading?' rich-hint-with-heading':''}`} role="note" aria-label={hintLabels[block.style]}><span className="rich-hint-icon" aria-hidden="true">{block.iconKey?<ReaderIcon icon={block.iconKey} size={20}/>:({info:'ⓘ',success:'✓',warning:'!',danger:'⚠'})[block.style]}</span><div className="rich-hint-content">{hasHeading&&<strong className="rich-hint-title">{block.title}</strong>}{block.body&&<p>{block.body}</p>}{children&&<div className="rich-hint-nested">{children}</div>}</div></aside>;
}
