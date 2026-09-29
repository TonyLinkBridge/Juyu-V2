import type {ReactNode} from 'react';
import {Callout} from 'fumadocs-ui/components/callout';
import type {TextBlock} from '../../../media/model';

// Draft preview deliberately uses the same Fumadocs component as the
// published reader. BlockNote remains the authoring surface only.
export function Hint({block,children}:{block:Extract<TextBlock,{type:'hint'}>;children?:ReactNode}){
 const hasHeading=block.showTitle!==false&&Boolean(block.title.trim());
 if(!hasHeading&&!block.body.trim()&&!children)return null;
 const type=block.style==='danger'?'error':block.style;
 return <Callout data-fumadocs-callout={block.id} type={type} title={hasHeading?block.title:undefined}>
  {block.body&&<p>{block.body}</p>}
  {children}
 </Callout>;
}
