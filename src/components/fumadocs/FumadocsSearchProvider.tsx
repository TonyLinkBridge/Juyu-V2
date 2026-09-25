import {RootProvider} from 'fumadocs-ui/provider/next';
import type {ReactNode} from 'react';
import {fumadocsRootI18n} from '../../fumadocs/i18n';
import type {FumadocsPublicationLocale} from '../../fumadocs/publication';
import {fumadocsSearchOptions} from '../../fumadocs/search-options';
import {FumadocsScopedSearchDialog} from './FumadocsScopedSearchDialog';

/** One localized Fumadocs search configuration for every formal Help Centre surface. */
export function FumadocsSearchProvider({locale='zh-CN',children}:{locale?:FumadocsPublicationLocale;children:ReactNode}){
 return <RootProvider
  theme={{enabled:false}}
  i18n={fumadocsRootI18n(locale)}
  search={{SearchDialog:FumadocsScopedSearchDialog,options:fumadocsSearchOptions(locale)}}
 >{children}</RootProvider>;
}
