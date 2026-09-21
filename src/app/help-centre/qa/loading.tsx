'use client';
import {useSearchParams} from 'next/navigation';
export default function Loading(){const english=useSearchParams().get('lang')==='en';return <main id="main-content" className="editor-main search-main" aria-busy="true"><h1>Q&amp;A</h1><p role="status">{english?'Loading questions and account access…':'正在加载问答与账号信息…'}</p></main>;}
