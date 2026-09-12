import {expect,type Page} from '@playwright/test';
type Decision={message:()=>string;accept:()=>Promise<void>;dismiss:()=>Promise<void>};
const decisions=new WeakMap<Page,(dialog:Decision)=>unknown>();
export function queueConfirmation(page:Page,decision:(dialog:Decision)=>unknown){decisions.set(page,decision);}
export async function settleConfirmation(page:Page){
 const decide=decisions.get(page);if(!decide)return;
 const dialog=page.getByRole('dialog',{name:'确认此操作',exact:true});
 if(!await dialog.isVisible())return;
 const message=await dialog.locator('p').innerText();
 await decide({message:()=>message,accept:()=>dialog.getByRole('button',{name:'确认继续',exact:true}).click(),dismiss:()=>dialog.getByRole('button',{name:'取消',exact:true}).click()});
 await expect(dialog).toHaveCount(0);
}
