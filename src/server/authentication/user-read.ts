import 'server-only';
import {cache} from 'react';
import {clerkClient} from '@clerk/nextjs/server';
import {measured} from '../performance.ts';
/** Render-local provider read. API mutations keep their own fresh provider reads. */
export const readClerkUser = cache(async (id:string) => measured('clerk.user',async()=>(await clerkClient()).users.getUser(id)));
