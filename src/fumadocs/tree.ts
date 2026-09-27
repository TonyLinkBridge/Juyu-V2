import type {Root} from 'fumadocs-core/page-tree';
import type {ReactNode} from 'react';

function treeIdentity(scope:string,parts:readonly string[]):string {
 return `juyu:${scope}:${parts.map(part=>encodeURIComponent(part)).join(',')}`;
}

/** Build the same root and root-folder shape emitted by the Fumadocs page-tree builder. */
export function fumadocsRootTree(scope:string,name:ReactNode,children:Root['children'],identity:readonly string[]=[]):Root {
 const id=treeIdentity(scope,identity);
 return {
  type:'root',
  $id:id,
  name,
  children:[{
   type:'folder',
   $id:`${id}:root`,
   name,
   root:true,
   defaultOpen:true,
   children,
  }],
 };
}
