import {Inline} from './Inline';
// Adapted from GitBook DocumentView/Paragraph.tsx (GPL-3.0).
// Text nodes replace vendor Inlines; no AI/context/external preview calls.
export function Paragraph({text}:{text:string}) {
 return <p className="paragraph" data-cover-aware-text="">{<Inline text={text}/>}</p>;
}
