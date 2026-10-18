import test from 'node:test';
import assert from 'node:assert/strict';
import {parseYouTubeUrl,youtubeIdFrom,validYouTubeId,normalizeVideoSource,videoText,publicMediaUrl} from '../src/lib/videoSource.js';
globalThis.document = { documentElement: { setAttribute() {} } };
const {normVideo} = await import('../src/data/normalize.js');
const id='dQw4w9WgXcQ';
test('YouTube URLs accept exact provider hosts and supported watch/short/live/embed forms',()=>{
 for(const url of [`https://www.youtube.com/watch?v=${id}&t=12`,`youtu.be/${id}?t=3`,`https://m.youtube.com/shorts/${id}`,`https://youtube.com/live/${id}`,`https://www.youtube-nocookie.com/embed/${id}`])assert.equal(youtubeIdFrom(url),id,url);
 assert.equal(parseYouTubeUrl(`https://youtube.com/shorts/${id}`).isShort,true);
 assert.equal(parseYouTubeUrl(`https://youtu.be/${id}`).url,`https://www.youtube.com/watch?v=${id}`);
});
test('Lookalike hosts, credential tricks, javascript and malformed IDs never become embeds',()=>{
 for(const value of [`https://youtube.com.evil.example/watch?v=${id}`,`https://evil.example/?v=${id}`,`https://youtube.com@evil.example/watch?v=${id}`,`https://user@youtube.com/watch?v=${id}`,`javascript:youtube.com/watch?v=${id}`,`https://youtu.be/${id}EXTRA`,`https://youtube.com/watch?v=${id}EXTRA`,`https://youtube.com:444/watch?v=${id}`,`https://evil.example/shorts/${id}`])assert.equal(youtubeIdFrom(value),'',value);
 assert.equal(validYouTubeId('<script>'),false);
 assert.equal(normVideo('bad',{youtubeId:'<script>',youtubeUrl:'https://evil.example/?v='+id}).youtubeId,'');
 assert.equal(normVideo('legacy',{youtubeId:id}).youtubeId,id);
});
test('New video sources are unambiguous, canonical and cannot use unsafe upload URLs',()=>{
 assert.deepEqual(normalizeVideoSource({youtubeUrl:`https://youtube.com/shorts/${id}`}),{youtubeId:id,youtubeUrl:`https://www.youtube.com/watch?v=${id}`,videoUrl:null,isShort:true});
 assert.throws(()=>normalizeVideoSource({}));assert.throws(()=>normalizeVideoSource({youtubeUrl:'https://evil.example/watch?v='+id}));
 assert.throws(()=>normalizeVideoSource({youtubeUrl:`https://youtu.be/${id}`,videoUrl:'https://example.com/v.mp4'}));
 assert.throws(()=>normalizeVideoSource({videoUrl:'javascript:alert(1)'}));
 assert.equal(normalizeVideoSource({videoUrl:'https://res.cloudinary.com/demo/video/upload/a.mp4'}).youtubeId,null);
});
test('Channel and publication text/media fields reject empty, oversized and unsafe values',()=>{
 assert.equal(videoText('  Channel  ',80,'name',true),'Channel');
 assert.throws(()=>videoText('',80,'name',true));assert.throws(()=>videoText('x'.repeat(81),80,'name',true));assert.throws(()=>videoText({},80,'name'));
 assert.equal(publicMediaUrl('','image'),'');assert.throws(()=>publicMediaUrl('data:image/png;base64,a','image'));assert.throws(()=>publicMediaUrl('https://user:pass@example.com/a','image'));
});
