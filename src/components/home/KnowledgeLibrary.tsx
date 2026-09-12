import type {NavigationNode} from '../../reader/tree';
import {NavigationLink as Link} from '../shell/NavigationLink';
function Directory({nodes}:{nodes:NavigationNode[]}){return <ul>{nodes.map(n=><li key={n.id}>{n.type==='group'?<details open><summary>{n.title}</summary><Directory nodes={n.descendants}/></details>:<Link prefetch={false} href={n.href}>{n.title}<span aria-hidden="true"> →</span></Link>}</li>)}</ul>;}
export function KnowledgeLibrary({pages}:{pages:NavigationNode[]}){return <main id="main-content" className="knowledge-library"><p className="reader-eyebrow">员工资料库</p><h1>知识资料</h1><p className="reader-description">按目录查阅已发布的操作指南和业务知识。</p>{pages.length?<Directory nodes={pages}/>:<div className="qa-empty"><h2>正式资料正在准备中</h2><p>文章审核发布后会显示在这里。</p></div>}</main>;}
