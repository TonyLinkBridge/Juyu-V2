import Link from 'next/link';
import { EntryShell } from '../components/entry-shell';
export default function NotFound() {
  return <EntryShell><main id="main-content" className="message-main"><p className="eyebrow">404</p><h1>没有找到这个页面</h1><p>链接可能已更改。你可以返回资料库入口。</p><Link className="primary-link" href="/">返回入口</Link></main></EntryShell>;
}
