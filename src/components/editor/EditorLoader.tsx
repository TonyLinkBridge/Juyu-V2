'use client';
import type {CategoryDefinition} from '../../categories/model';
import type {FieldDefinition} from '../../fields/model';
import dynamic from 'next/dynamic';
import {Component,type ReactNode} from 'react';
import type {EditorData} from '../../editor/contract';
const ArticleEditor=dynamic(()=>import('./ArticleEditor'),{ssr:false,loading:()=> <p role="status">正在载入编辑器…</p>});
class EditorBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<section role="alert"><p>编辑器暂时无法载入，尚未保存的输入请勿关闭页面。</p><button onClick={()=>window.location.reload()}>重新载入编辑器</button></section>:this.props.children;}}
export function EditorLoader({initial,recoveryOwner='',newReference=false,newQa=false,newOps=false,fieldDefinitions=[],categoryOptions=[]}:{initial:EditorData|null;recoveryOwner?:string;newReference?:boolean;newQa?:boolean;newOps?:boolean;fieldDefinitions?:FieldDefinition[];categoryOptions?:CategoryDefinition[]}){return <EditorBoundary><ArticleEditor recoveryOwner={recoveryOwner} categoryOptions={categoryOptions} initial={initial} newReference={newReference} newQa={newQa} newOps={newOps} fieldDefinitions={fieldDefinitions}/></EditorBoundary>;}
