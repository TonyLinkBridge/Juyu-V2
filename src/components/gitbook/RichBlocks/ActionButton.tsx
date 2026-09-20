import type {MediaBlock} from '../../../media/model';
export function ActionButton({block}:{block:Extract<MediaBlock,{type:'button'}>}){
 const external=/^https?:\/\//i.test(block.href);
 return <p className="rich-action-wrap"><a className={`rich-action rich-action-${block.variant}`} href={block.href} target={external?'_blank':undefined} rel={external?'noopener noreferrer':undefined}>{block.label}<span aria-hidden="true">↗</span></a></p>;
}
