"use client";
// Used only by the development-only design preview route; never calls production APIs.
import {useState} from 'react';
import {BookmarkSimple} from '@phosphor-icons/react';
export function PreviewArticleActions(){
 const [saved,setSaved]=useState(false);
 return <section className="favorite-control" aria-label="文章收藏（本地示例）"><button type="button" className="secondary-link" aria-pressed={saved} onClick={()=>setSaved(!saved)}><BookmarkSimple size={20} aria-hidden="true"/>{saved?'取消收藏':'收藏文章'}</button></section>;
}
