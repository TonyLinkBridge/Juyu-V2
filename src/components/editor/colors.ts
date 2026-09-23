'use client';
import {createStyleSpec} from '@blocknote/core';
import {displayColor,color,isNeutralBlack} from '../../editor/inline';
const nativeNames=new Set(['default','gray','brown','red','orange','yellow','green','blue','purple','pink']);
/** Keep the native palette/theme, and display literal CSS colors imported by native rich paste. */
function nativeColor<const T extends 'textColor'|'backgroundColor'>(type:T){
 const property=type==='textColor'?'color':'backgroundColor';
 const render=(value:string)=>{const span=document.createElement('span');if(!nativeNames.has(value)&&!(type==='textColor'&&isNeutralBlack(value))){try{span.style[property]=color(value);}catch{ /* Invalid clipboard styles remain inert until document validation. */ }}return {dom:span,contentDOM:span};};
 return createStyleSpec({type,propSchema:'string'}, {render,toExternalHTML:value=>{const span=document.createElement('span');if(value!=='default'){try{span.style[property]=displayColor(color(value),type==='backgroundColor')??'';}catch{}}return {dom:span,contentDOM:span};},parse:element=>element.tagName==='SPAN'&&element.style[property]?element.style[property]:undefined});
}
export const nativeTextColor=nativeColor('textColor');
export const nativeBackgroundColor=nativeColor('backgroundColor');
