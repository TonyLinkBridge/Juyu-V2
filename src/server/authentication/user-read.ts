import 'server-only';
import {cache} from 'react';
import {clerkClient} from '@clerk/nextjs/server';
import {measured} from '../performance.ts';
import {createVerificationReader} from './verification-reader.ts';
/** Render-local provider read. API mutations keep their own fresh provider reads. */
const verificationReads=createVerificationReader(async (id:string) => measured('clerk.user',async()=>(await clerkClient()).users.getUser(id)));
export const readClerkUser = cache(verificationReads.read);
export const withFreshUserRead = verificationReads.run;
