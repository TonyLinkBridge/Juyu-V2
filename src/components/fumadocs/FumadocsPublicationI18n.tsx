'use client';
import {zhCN} from '@fumadocs/language/zh-cn';
import {I18nProvider} from 'fumadocs-ui/contexts/i18n';
import type {ReactNode} from 'react';
import type {FumadocsLanguageDestinations,FumadocsPublicationLocale} from '../../fumadocs/publication';

const simplifiedChinese=zhCN().value;

const names:Record<FumadocsPublicationLocale,string>={'zh-CN':'简体中文',en:'English'};

export function FumadocsPublicationI18n({locale,destinations={},children}:{locale:FumadocsPublicationLocale;destinations?:FumadocsLanguageDestinations;children:ReactNode}){
 const locales=(['zh-CN','en'] as const).filter(item=>Boolean(destinations[item])).map(item=>({locale:item,name:names[item]}));
 return <I18nProvider
  locale={locale}
  locales={locales}
  translations={locale==='zh-CN'?simplifiedChinese:undefined}
  onLocaleChange={next=>{const destination=destinations[next as FumadocsPublicationLocale];if(destination)window.location.assign(destination);}}
 >{children}</I18nProvider>;
}
