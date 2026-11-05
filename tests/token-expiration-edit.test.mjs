import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/manage/apiTokens.js';
const source=readFileSync(new URL('../frontend/src/utils/tokenExpiration.js',import.meta.url),'utf8');
const {expirationEditor,expirationUpdate,computeExpiresAt}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const base=new Date('2030-01-01T12:00:00Z');
function fixture(){const data=new Map();const env={img_url:{get:async key=>data.get(key)??null,put:async(key,value)=>data.set(key,value)}};const call=async(method,body)=>onRequest({env,request:new Request('https://example.test/api/manage/apiTokens',{method,...(body?{body:JSON.stringify(body)}:{})})});return{call,data};}
test('duration and unit persist through create, update, list and reopen without moving deadline',async()=>{
 const f=fixture();const created=await(await f.call('POST',{name:'test',owner:'admin',permissions:['list'],expiresAt:computeExpiresAt(base,7,'d'),expirationValue:7,expirationUnit:'d'})).json();
 let row=(await(await f.call('GET')).json()).tokens[0];assert.equal(row.expirationValue,7);assert.equal(row.expirationUnit,'d');
 let editor={...expirationEditor(row,base),autoDelete:false};editor.expirationValue=3;editor.expirationUnit='M';
 let patch=expirationUpdate(editor,base);assert.equal(patch.expiresAt,'2030-04-01T12:00:00.000Z');
 const updated=await(await f.call('PUT',{tokenId:created.id,permissions:['list'],...patch})).json();assert.equal(updated.success,true);assert.equal(updated.settings.expirationValue,3);assert.equal(updated.settings.expirationUnit,'M');assert.equal(updated.settings.token,undefined);
 row=(await(await f.call('GET')).json()).tokens[0];editor={...expirationEditor(row,new Date('2030-02-01')),autoDelete:false};assert.equal(editor.expirationValue,3);assert.equal(editor.expirationUnit,'M');assert.equal(expirationUpdate(editor,new Date('2030-02-01')).expiresAt,patch.expiresAt);
 await f.call('PUT',{tokenId:created.id,permissions:['manage']});row=(await(await f.call('GET')).json()).tokens[0];assert.equal(row.expiresAt,patch.expiresAt);assert.equal(row.expirationUnit,'M');
});
test('legacy and expired deadlines survive permission-only edits; never-expire can be toggled',()=>{
 for(const deadline of ['2030-01-04T12:00:00.000Z','2020-01-01T00:00:00.000Z']){const editor={...expirationEditor({expiresAt:deadline},base),autoDelete:false};assert.equal(editor.legacyExpiration,true);assert.equal(expirationUpdate(editor,new Date('2030-02-01')).expiresAt,deadline);editor.expirationValue+=1;assert.notEqual(expirationUpdate(editor,base).expiresAt,deadline);}
 const editor=expirationEditor({expiresAt:null},base);assert.deepEqual(expirationUpdate(editor,base),{expiresAt:null,expirationValue:null,expirationUnit:null,autoDelete:false});editor.neverExpire=false;editor.expirationValue=2;editor.expirationUnit='h';assert.equal(expirationUpdate(editor,base).expiresAt,'2030-01-01T14:00:00.000Z');
});
test('invalid expiration settings are rejected without changing persisted configuration',async()=>{
 const f=fixture();const row=await(await f.call('POST',{name:'test',owner:'admin',permissions:['list']})).json();const before=[...f.data];
 for(const fields of [{expiresAt:'bad'},{expiresAt:4},{expiresAt:'2030-01-01',expirationValue:0,expirationUnit:'d'},{expiresAt:'2030-01-01',expirationValue:2,expirationUnit:'unknown'},{expiresAt:'2030-01-01',expirationValue:1.5,expirationUnit:'d'}]){assert.equal((await f.call('PUT',{tokenId:row.id,permissions:['list'],...fields})).status,400);assert.deepEqual([...f.data],before);}
 assert.equal((await f.call('PUT',{tokenId:'missing',permissions:['list']})).status,404);
 await f.call('PUT',{tokenId:row.id,permissions:['list'],expiresAt:null,expirationValue:null,expirationUnit:null,autoDelete:true});const saved=(await(await f.call('GET')).json()).tokens[0];assert.equal(saved.expiresAt,null);assert.equal(saved.autoDelete,false);
});
