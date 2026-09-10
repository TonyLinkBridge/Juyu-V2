 'use client';
import type {ScienceBlock} from '../media/model';
import {mathMarkup,validateDiagram} from '../science/model';
export function ScienceFields({block,onChange}:{block:ScienceBlock;onChange:(value:ScienceBlock)=>void}){let error='';try{if(block.type==='math')mathMarkup(block.source);else validateDiagram(block.source);}catch(e){error=e instanceof Error?e.message:'格式错误';}return <><label>{block.type==='math'?'公式原文':'流程图原文'}<textarea rows={6} maxLength={block.type==='math'?2000:4000} value={block.source} onChange={e=>onChange({...block,source:e.target.value})}/></label><label>图形说明<input maxLength={500} value={block.caption} onChange={e=>onChange({...block,caption:e.target.value})}/></label>{error&&<p role="alert">{error}</p>}<p>可先保存草稿。展开下方预览检查显示结果；错误原文会保留，便于修正。</p></>;}
