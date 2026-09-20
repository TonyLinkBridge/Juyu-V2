export interface ExternalEmbedSource {provider:'YouTube'|'Vimeo'|'Loom'|'Figma'|'Google Drive';frame:string;original:string}
const videoId=/^[A-Za-z0-9_-]{11}$/;
const loomId=/^[A-Za-z0-9]{16,64}$/;
const driveId=/^[A-Za-z0-9_-]{20,100}$/;
/** Unknown hosts stay links. Never load them into an iframe or fetch them server-side. */
export function externalLinkSource(value:string):{original:string;host:string}|null{
 if(!value||value.length>2048||/[\x00-\x1f\x7f]/.test(value))return null;
 let url:URL;try{url=new URL(value);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||url.hostname.endsWith('.local')||/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)||url.hostname.startsWith('['))return null;
 return {original:url.toString(),host:url.hostname.toLowerCase()};
}
export function externalEmbedSource(value:string):ExternalEmbedSource|null{
 if(!externalLinkSource(value))return null;
 let url:URL;try{url=new URL(value);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null;
 const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
 if((host==='www.youtube.com'||host==='youtube.com')&&parts.length===1&&parts[0]==='watch'){
  const id=url.searchParams.get('v');if(!id||!videoId.test(id)||[...url.searchParams.keys()].some(key=>key!=='v'))return null;
  return {provider:'YouTube',frame:`https://www.youtube-nocookie.com/embed/${id}`,original:`https://www.youtube.com/watch?v=${id}`};
 }
 if(host==='youtu.be'&&parts.length===1&&videoId.test(parts[0])&&!url.search)return {provider:'YouTube',frame:`https://www.youtube-nocookie.com/embed/${parts[0]}`,original:`https://youtu.be/${parts[0]}`};
 if((host==='vimeo.com'&&parts.length===1||host==='player.vimeo.com'&&parts.length===2&&parts[0]==='video')&&/^\d{5,15}$/.test(parts.at(-1)??'')&&!url.search){const id=parts.at(-1)!;return {provider:'Vimeo',frame:`https://player.vimeo.com/video/${id}`,original:`https://vimeo.com/${id}`};}
 if(host==='www.loom.com'&&parts.length===2&&['share','embed'].includes(parts[0])&&loomId.test(parts[1])&&!url.search)return {provider:'Loom',frame:`https://www.loom.com/embed/${parts[1]}`,original:`https://www.loom.com/share/${parts[1]}`};
 if(host==='drive.google.com'&&parts.length===4&&parts[0]==='file'&&parts[1]==='d'&&driveId.test(parts[2])&&['view','preview'].includes(parts[3])&&[...url.searchParams.keys()].every(key=>key==='usp'))return {provider:'Google Drive',frame:`https://drive.google.com/file/d/${parts[2]}/preview`,original:`https://drive.google.com/file/d/${parts[2]}/view`};
 if(host==='www.figma.com'&&parts.length>=2&&['file','design','proto'].includes(parts[0])&&/^[A-Za-z0-9]{10,64}$/.test(parts[1])&&[...url.searchParams.keys()].some(key=>!['node-id','page-id','scaling'].includes(key))===false){const original=url.toString();return {provider:'Figma',frame:`https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(original)}`,original};}
 return null;
}
