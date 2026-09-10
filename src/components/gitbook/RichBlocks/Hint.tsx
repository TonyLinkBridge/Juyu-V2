import {hintLabels,type TextBlock} from '../../../media/model';
// Adapted from GitBook Hint: semantic style, bordered container, title and body.
export function Hint({block}:{block:Extract<TextBlock,{type:'hint'}>}){
 return <aside className={`rich-hint rich-hint-${block.style}`} aria-label={hintLabels[block.style]}><div className="rich-hint-heading"><span aria-hidden="true">{({info:'ⓘ',success:'✓',warning:'!',danger:'⚠'})[block.style]}</span><strong>{hintLabels[block.style]}{block.title&&` · ${block.title}`}</strong></div><p>{block.body}</p></aside>;
}
