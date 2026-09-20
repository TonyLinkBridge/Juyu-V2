import assert from 'node:assert/strict';
import {test} from 'node:test';
import {externalEmbedSource,externalLinkSource} from '../src/media/external-embed.ts';
import {normalizeBlocks} from '../src/media/model.ts';
import {pdfHTML} from '../src/pdf/render.ts';

test('external embed accepts only known HTTPS providers and canonical frame URLs',()=>{
 assert.deepEqual(externalEmbedSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),{provider:'YouTube',frame:'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',original:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'});
 assert.equal(externalEmbedSource('https://vimeo.com/123456789')?.frame,'https://player.vimeo.com/video/123456789');
 assert.equal(externalEmbedSource('https://www.loom.com/share/0123456789abcdef')?.frame,'https://www.loom.com/embed/0123456789abcdef');
 assert.equal(externalEmbedSource('https://www.figma.com/file/AbCd1234567890/Guide')?.provider,'Figma');
 assert.deepEqual(externalEmbedSource('https://drive.google.com/file/d/AbCd1234567890efGhIjKlMn/view?usp=sharing'),{provider:'Google Drive',frame:'https://drive.google.com/file/d/AbCd1234567890efGhIjKlMn/preview',original:'https://drive.google.com/file/d/AbCd1234567890efGhIjKlMn/view'});
 for(const url of ['http://www.youtube.com/watch?v=dQw4w9WgXcQ','https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ','https://user:secret@www.youtube.com/watch?v=dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ&next=https://evil.invalid','javascript:alert(1)'])assert.equal(externalEmbedSource(url),null);
});
test('external embed remains a link in PDF and invalid hosts cannot enter a document',()=>{
 const block={id:'video',type:'externalEmbed',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',caption:'操作影片'};
 assert.deepEqual(normalizeBlocks([block]),[block]);
 assert.equal(externalEmbedSource('https://example.com/guide'),null);
 assert.equal(externalLinkSource('https://example.com/guide')?.host,'example.com');
 assert.deepEqual(normalizeBlocks([{...block,url:'https://example.com/guide'}]),[{...block,url:'https://example.com/guide'}]);
 for(const unsafe of ['http://example.com/guide','https://user:secret@example.com/guide','https://127.0.0.1/private','https://localhost/private','https://example.com:8443/guide'])assert.throws(()=>normalizeBlocks([{...block,url:unsafe}]),/INVALID_MEDIA/);
 const html=pdfHTML({id:'guide',title:'示例',revision:1,body:'',blocks:normalizeBlocks([block])});
 assert.match(html,/href="https:\/\/www.youtube.com\/watch\?v=dQw4w9WgXcQ"/);
 const linked=pdfHTML({id:'guide',title:'示例',revision:1,body:'',blocks:normalizeBlocks([{...block,url:'https://example.com/guide'}])});
 assert.match(linked,/href="https:\/\/example.com\/guide"/);
 assert.doesNotMatch(html,/<iframe/);
});
