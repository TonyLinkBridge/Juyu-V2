'use client';
import {createContext,useContext,type ReactNode} from 'react';
import type {NavigationPage} from '../../../reader/navigation';

const Context=createContext<{pages:Readonly<Record<string,NavigationPage>>;locale:'zh-CN'|'en'}|null>(null);
export function ArticleReferenceProvider({pages,aliases={},locale='zh-CN',children}:{pages:NavigationPage[];aliases?:Record<string,string>;locale?:'zh-CN'|'en';children:ReactNode}){
 const map=Object.fromEntries(pages.map(page=>[page.id,page]));
 for(const [source,target] of Object.entries(aliases))if(map[target])map[source]=map[target];
 return <Context.Provider value={{pages:map,locale}}>{children}</Context.Provider>;
}
export function useAuthorizedReference(targetId:string){return useContext(Context)?.pages[targetId]??null;}
export function useReaderLocale(){return useContext(Context)?.locale??'zh-CN';}
