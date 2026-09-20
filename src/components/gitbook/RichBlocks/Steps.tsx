import type {TextBlock} from '../../../media/model';
import {decodeTabBody} from '../../../media/tab-body';
import {StructuredDocument} from '../Reading/StructuredDocument';

export function Steps({block,documentId,revision,admin=false,locale='zh-CN'}:{block:Extract<TextBlock,{type:'steps'}>;documentId?:string;revision?:number;admin?:boolean;locale?:'zh-CN'|'en'}){
 return <section className="rich-steps" aria-label={locale==='en'?'Steps':'操作步骤'}><ol>{block.steps.map((step,index)=><li key={step.id}><span className="rich-step-number" aria-hidden="true">{index+1}</span><div className="rich-step-content"><h3>{step.title||(locale==='en'?`Step ${index+1}`:`步骤 ${index+1}`)}</h3>{decodeTabBody(step.body)?<StructuredDocument blocks={decodeTabBody(step.body)!} documentId={documentId} revision={revision} admin={admin} locale={locale}/>:step.body?<p>{step.body}</p>:null}</div></li>)}</ol></section>;
}
