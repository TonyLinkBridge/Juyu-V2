import { parseRole } from '../../domain/access.ts';
import type { Role } from '../../domain/model.ts';
export type MemberChange = {type:'role';role:Role;expectedRole:Role}|{type:'disable';disabled:boolean};
export function parseMemberChange(input:unknown):MemberChange {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_INPUT');
 const value=input as Record<string,unknown>;
 if(value.type==='role'&&Object.keys(value).sort().join(',')==='expectedRole,role,type'){
  const role=parseRole(value.role),expectedRole=parseRole(value.expectedRole);
  if(role&&expectedRole)return {type:'role',role,expectedRole};
 }
 if(value.type==='disable'&&typeof value.disabled==='boolean'&&Object.keys(value).sort().join(',')==='disabled,type') return {type:'disable',disabled:value.disabled};
 throw new Error('INVALID_INPUT');
}
