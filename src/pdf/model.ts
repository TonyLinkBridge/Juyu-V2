import type {Publication} from '../reader/body.ts';
export interface PDFSnapshot {article:Publication;files:{id:string;filename:string;size:string}[]}
