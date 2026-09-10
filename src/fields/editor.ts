import type {FieldType,FieldSnapshot} from './model.ts';
export function fieldInputValue(type:FieldType,input:string):FieldSnapshot['value'] {
 if(input==='')return null;
 if(type==='boolean'){if(input==='true')return true;if(input==='false')return false;throw new Error('INVALID_INPUT');}
 if(type==='number'){if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input)||!Number.isFinite(Number(input)))throw new Error('INVALID_INPUT');return Number(input);}
 return input;
}
export function fieldValueText(value:FieldSnapshot['value']):string{return value===null?'未填写':typeof value==='boolean'?(value?'是':'否'):String(value);}
