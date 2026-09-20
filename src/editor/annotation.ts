const prefix='#juyu-note-';
export function annotationHref(note:string):string{
 const value=note.trim();if(!value||value.length>500)throw new Error('INVALID_ANNOTATION');
 const bytes=new TextEncoder().encode(value);if(bytes.length>1500)throw new Error('INVALID_ANNOTATION');
 return prefix+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function annotationText(href:string):string|null{
 if(!href.startsWith(prefix))return null;
 const encoded=href.slice(prefix.length);if(!encoded||encoded.length>2000||!/^[A-Za-z0-9_-]+$/.test(encoded))return null;
 try{const base=encoded.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(base),character=>character.charCodeAt(0));const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);return text&&text.length<=500&&annotationHref(text)===href?text:null;}catch{return null;}
}
