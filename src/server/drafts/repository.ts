import type {PoolClient} from 'pg';
import {draftActionInput,type DraftActionResult} from '../../drafts/model.ts';
export async function discardWorkingDraft(client:PoolClient,id:string,input:unknown):Promise<DraftActionResult>{
 const value=draftActionInput(input);
 const row=(await client.query<{document_id:string;sequence:number;revision:number;published_revision:number;status:'published'}>('SELECT * FROM juyu.discard_working_draft($1,$2)',[id,value.expectedSequence])).rows[0];
 return {documentId:row.document_id,sequence:row.sequence,revision:row.revision,publishedRevision:row.published_revision,status:row.status};
}
