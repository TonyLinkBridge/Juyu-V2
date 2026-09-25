import {zhCN} from '@fumadocs/language/zh-cn';
import type {I18nProviderProps} from 'fumadocs-ui/contexts/i18n';
import type {FumadocsPublicationLocale} from './publication.ts';

export const simplifiedChineseFumadocs=zhCN().value;

export function fumadocsRootI18n(locale:FumadocsPublicationLocale):Pick<I18nProviderProps,'locale'|'translations'> {
 return {locale,translations:locale==='zh-CN'?simplifiedChineseFumadocs:undefined};
}
