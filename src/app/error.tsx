"use client";
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main-content" className="message-main"><h1>页面暂时无法打开</h1><p>请重试，或返回资料库入口。</p><button className="primary-link" onClick={reset}>重新尝试</button><Link className="back-link" href="/">返回入口</Link></main>;
}
