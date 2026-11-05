import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramSendHandler, TELEGRAM_REUPLOAD_LIMIT } from '../functions/utils/telegramSend.js';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { onRequest as route } from '../functions/api/manage/telegramSend.js';
function fixture() {
 const map=new Map(),calls=[];let reads=0;const env={TG_UPLOAD_ALLOWED_USER_IDS:'555,555,invalid',img_url:{get:async k=>map.get(k)?.value??null,getWithMetadata:async k=>structuredClone(map.get(k)||{value:null,metadata:null}),put:async(k,value,o={})=>map.set(k,structuredClone({value,metadata:o.metadata})),delete:async k=>map.delete(k)}};
 const db=getDatabase(env);const channels=[{name:'primary',botToken:'123:fake',enabled:true},{name:'disabled',botToken:'9:disabled',enabled:false},{name:'other',botToken:'456:fake',enabled:true}];
 const services={authorize:async()=>true,getDatabase:()=>db,getUploadConfig:async()=>({telegram:{channels}}),getSecurityConfig:async()=>({telegramBot:{allowedUsers:[{id:'777',note:'Bob'},{id:'555',note:'Me'}]}}),readFile:async()=>{reads++;return new Response('original-file',{headers:{'Content-Type':'image/png'}});},call:async(c,method,body)=>{calls.push({channel:c.name,method,body});return{ok:true,messageId:10};}};
 const context=(body,method='POST')=>({env,request:new Request('https://example.test/api/manage/telegramSend',{method,...(method==='POST'?{body:JSON.stringify(body)}:{})})});
 const send=body=>createTelegramSendHandler(services)(context({fileId:'a.png',channel:'primary',recipient:'555',...body}));
 const file=async(metadata={})=>db.put('a.png','',{metadata:{Channel:'TelegramNew',ChannelName:'primary',TimeStamp:1,FileName:'a.png',FileType:'image/png',TgFileId:'tg-file-id',...metadata}});
 return{env,map,db,calls,services,context,send,file,get reads(){return reads;}};
}
test('options reveal only channel names and suggested numeric IDs; never send on GET',async()=>{
 const f=fixture();const response=await createTelegramSendHandler(f.services)(f.context(null,'GET'));const body=await response.json();assert.deepEqual(body.channels,[{name:'primary'},{name:'other'}]);assert.deepEqual(body.recipients,[{id:'555',note:'Me'},{id:'777',note:'Bob'}]);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.ok(!JSON.stringify(body).includes(':fake'));assert.equal(f.calls.length,0);
});
test('same-bot existing documents resend by file ID and current caption, without downloading or modifying metadata',async()=>{
 const f=fixture();await f.file();const before=structuredClone([...f.map]);const id=(await f.db.getWithMetadata('a.png')).metadata.FixedId;const response=await f.send({fileId:id});assert.equal(response.status,200);assert.equal((await response.json()).success,true);assert.equal(f.reads,0);assert.deepEqual(f.calls.map(c=>[c.method,c.body.document,c.body.chat_id]),[['sendDocument','tg-file-id','555']]);assert.deepEqual([...f.map],before);
});
test('photo IDs fall back only after an explicit media mismatch rejection',async()=>{
 const f=fixture();await f.file();f.services.call=async(c,method,body)=>{f.calls.push({method,body});return method==='sendDocument'?{ok:false,code:400,mediaMismatch:true}:{ok:true,messageId:2};};assert.equal((await f.send()).status,200);assert.deepEqual(f.calls.map(c=>c.method),['sendDocument','sendPhoto']);
 f.calls.length=0;f.services.call=async()=>{f.calls.push('call');return{ok:false,code:400,recipientUnavailable:true};};assert.equal((await(await f.send()).json()).error,'recipient_unavailable');assert.equal(f.calls.length,1);
});
test('non-Telegram and cross-bot files are read internally and sent as original documents',async()=>{
 for(const metadata of [{Channel:'CloudflareR2',TgFileId:null},{ChannelName:'other'}]){const f=fixture();await f.file(metadata);assert.equal((await f.send()).status,200);assert.equal(f.reads,1);const form=f.calls[0].body;assert.ok(form instanceof FormData);assert.equal(form.get('chat_id'),'555');assert.equal(form.get('document').name,'a.png');assert.equal(await form.get('document').text(),'original-file');}
});
test('invalid IDs, disabled bot, folders, external URLs, oversized and redirected files never send',async()=>{
 const f=fixture();await f.file();for(const patch of [{recipient:'@name'},{recipient:'-100123'},{recipient:'9007199254740999'},{fileId:'manage@sysConfig@security'},{channel:'disabled'},{fileId:'missing-folder'}])assert.ok((await f.send(patch)).status>=400);assert.equal(f.calls.length,0);
 await f.file({Channel:'External'});assert.equal((await(await f.send()).json()).error,'external_file_unsupported');
 await f.file({Channel:'CloudflareR2',FileSizeBytes:TELEGRAM_REUPLOAD_LIMIT+1});assert.equal((await(await f.send()).json()).error,'file_too_large');assert.equal(f.reads,0);
 await f.file({Channel:'CloudflareR2'});f.services.readFile=async()=>Response.redirect('https://other.example/private',302);assert.equal((await(await f.send()).json()).error,'file_unavailable');assert.equal(f.calls.length,0);
 f.services.readFile=async()=>new Response('x',{headers:{'Content-Length':String(TELEGRAM_REUPLOAD_LIMIT+1)}});assert.equal((await(await f.send()).json()).error,'file_too_large');assert.equal(f.calls.length,0);
});
test('rate limits and ambiguous network failures are sanitized and never auto-retried',async()=>{
 const f=fixture();await f.file();f.services.call=async()=>{f.calls.push('call');return{ok:false,code:429,retryAfter:12};};let response=await f.send();assert.equal(response.status,429);assert.equal((await response.json()).retryAfter,12);assert.equal(f.calls.length,1);
 f.services.call=async()=>{throw Error('https://api.telegram.org/bot123:fake/private');};response=await f.send();assert.equal(response.status,502);const text=await response.text();assert.ok(text.includes('delivery_unknown'));assert.ok(!text.includes(':fake'));
});
test('authorization is required before configuration or sending; organize-only token cannot access endpoint',async()=>{
 const f=fixture();f.services.authorize=async()=>false;f.services.getUploadConfig=async()=>{throw Error('must not read config');};assert.equal((await f.send()).status,401);assert.equal(f.calls.length,0);
 const settings={auth:{admin:{adminUsername:'admin',adminPassword:'configured'}},apiTokens:{tokens:{organizer:{token:'organize-only-test',permissions:['organize']},manager:{token:'manage-test',permissions:['manage']}}}};
 f.map.set('manage@sysConfig@security',{value:JSON.stringify(settings)});
 for(const token of ['bad','organize-only-test']) {const response=await route({env:f.env,request:new Request('https://example.test/api/manage/telegramSend',{headers:{Authorization:'Bearer '+token}})});assert.equal(response.status,401);}
 const allowed=await route({env:f.env,request:new Request('https://example.test/api/manage/telegramSend',{headers:{Authorization:'Bearer manage-test'}})});assert.equal(allowed.status,200);
});
test('production endpoint reads original R2 bytes with admin access and uploads a document',async()=>{
 const f=fixture();await f.file({Channel:'CloudflareR2'});f.env.TG_BOT_TOKEN='123:fake';f.env.TG_CHAT_ID='-100555';
 f.env.img_r2={get:async key=>{assert.equal(key,'a.png');return{body:new Blob(['r2-original']).stream(),size:11,writeHttpMetadata:headers=>headers.set('Content-Type','image/png')};}};
 const originalFetch=globalThis.fetch;const originalCaches=globalThis.caches;const sent=[];globalThis.caches={default:{put:async()=>{},match:async()=>undefined}};
 globalThis.fetch=async(input,options)=>{sent.push(options.body);return Response.json({ok:true,result:{message_id:12}});};
 try{const response=await route({env:f.env,data:{},waitUntil:()=>{},request:new Request('https://example.test/api/manage/telegramSend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:'a.png',recipient:'555',channel:'Telegram_env'})})});assert.equal(response.status,200,await response.clone().text());assert.equal(sent.length,1);assert.ok(sent[0] instanceof FormData);assert.equal(await sent[0].get('document').text(),'r2-original');}
 finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
test('recipients outside the Telegram allowlist are rejected before any delivery',async()=>{
 const f=fixture();await f.file();const response=await f.send({recipient:'999'});assert.equal(response.status,403);assert.equal((await response.json()).error,'recipient_not_allowed');assert.equal(f.calls.length,0);assert.equal(f.reads,0);
 assert.equal((await f.send({recipient:'777'})).status,200);
});
