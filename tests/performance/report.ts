import {mkdir,writeFile} from 'node:fs/promises';
import {cpus,totalmem,platform,release,arch} from 'node:os';
export async function writeReport(name:string,data:unknown){await mkdir('output/verification/T058',{recursive:true});await writeFile(`output/verification/T058/${name}.json`,JSON.stringify({at:new Date().toISOString(),environment:{node:process.version,platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramBytes:totalmem()},...data as object},null,2)+'\n');}
export function summary(samples:number[]){const ordered=[...samples].sort((a,b)=>a-b);return {samplesMs:samples,medianMs:ordered[Math.floor(ordered.length/2)],maxMs:ordered.at(-1)};}
