import 'server-only';
import {cache} from 'react';
import {applicationAuthorization} from './authorization/application';
import {measured} from './performance';
// Request-scoped only. A new request rechecks identity and reads current settings.
export const readReaderPresentation=cache(async()=>measured('reader.frame',async()=>(await applicationAuthorization()).readerChrome()));
