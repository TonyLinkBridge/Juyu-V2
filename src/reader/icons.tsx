import type {ReaderIconKey} from './icon-keys';
import {readerIconComponents} from './icon-components';
export function ReaderIcon({icon,size=16,className='toc-icon'}:{icon:ReaderIconKey;size?:number;className?:string}){
 const Glyph=readerIconComponents[icon];return <Glyph size={size} className={className} aria-hidden="true"/>;
}
