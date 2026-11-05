import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { onRequest as agent } from '../functions/api/agent/[[path]].js';
import { authenticate, AUTH_SCOPE } from '../functions/utils/auth/authCore.js';
import { onRequest as listFiles } from '../functions/api/manage/list.js';
import { storedSubfolders, validFolder, updateFolderEntries } from '../functions/utils/organizationCatalog.js';
import { agentOpenApi } from '../functions/utils/agentOpenApi.js';
function fixture() {
    const map = new Map(); const tasks = [];
    const env = { TG_BOT_TOKEN:'123:test', TG_CHAT_ID:'-100123', img_url: {
        get: async key => map.get(key)?.value ?? null,
        getWithMetadata: async key => structuredClone(map.get(key) || {value:null,metadata:null}),
        put: async (key,value,options={}) => map.set(key,structuredClone({value,metadata:options.metadata || null})),
        delete: async key => map.delete(key),
        list: async ({prefix=''}={}) => ({keys:[...map].filter(([key])=>key.startsWith(prefix)).map(([name,r])=>({name,metadata:r.metadata})),list_complete:true})
    }};
    map.set('manage@sysConfig@security',{value:JSON.stringify({apiTokens:{tokens:{
        agent:{id:'agent',token:'test-agent',permissions:['organize']},
        list:{id:'list',token:'test-list',permissions:['list']},
        expired:{id:'expired',token:'expired',permissions:['organize'],expiresAt:'2000-01-01T00:00:00Z'},
        malformed:{id:'malformed',token:'malformed',permissions:['organize'],expiresAt:'invalid'}
    }}})});
    const context = (path='',method='GET',body,token='test-agent') => ({env,data:{}, params:{}, waitUntil:p=>tasks.push(p),
        request:new Request('https://img.example/api/agent/'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})});
    return {map,env,db:getDatabase(env),tasks,context};
}
async function addFile(f,path='photos/a.png') {
    await f.db.put(path,'',{metadata:{FileName:path.split('/').pop(),FileType:'image/png',TimeStamp:1700000000000,Channel:'TelegramNew',TgFileId:'photo',Directory:'photos/',Tags:['旧标签'],UploadIP:'private-ip'}});
    return (await f.db.getWithMetadata(path)).metadata.FixedId;
}
test('agent requires a valid key; legacy organize retains browsing without gaining replacement',async()=>{
    const f=fixture();
    for(const token of [null,'bad','expired','malformed']) assert.equal((await agent(f.context('','GET',null,token))).status,401,token);
    assert.equal((await agent(f.context('','GET',null,'test-list'))).status,200);
    assert.equal((await agent(f.context())).status,200);
    for(const permission of ['manage','delete','upload','replace']) {
        const auth=await authenticate({env:f.env,request:f.context().request,requiredPermission:permission,authScope:AUTH_SCOPE.ADMIN});
        assert.equal(auth.authorized,false,permission);
    }
    const good=await authenticate({env:f.env,request:f.context().request,requiredPermission:'organize',authScope:AUTH_SCOPE.ADMIN});
    assert.equal(good.authorized,true);
    const setting=JSON.parse(f.map.get('manage@sysConfig@security').value);delete setting.apiTokens.tokens.agent;
    f.map.set('manage@sysConfig@security',{value:JSON.stringify(setting)});
    assert.equal((await agent(f.context())).status,401);
});
test('agent rejects destructive/admin operations and arbitrary list actions',async()=>{
    const f=fixture(); const id=await addFile(f);
    for(const [path,method] of [['files/'+id,'DELETE'],['files/'+id+'/metadata','POST'],['apiTokens','POST'],['sysConfig/security','GET']]) {
        assert.equal((await agent(f.context(path,method,method === 'GET' ? undefined : {FileType:'text/plain'}))).status,404,path);
    }
    assert.equal((await agent(f.context('files?action=delete-operations&count=-1'))).status,400);
    assert.ok((await f.db.getWithMetadata('photos/a.png')).metadata);
});
test('dry runs, conflicts and stale preconditions preserve all stored files',async()=>{
    const f=fixture(); const id=await addFile(f);await addFile(f,'photos/taken.png');
    const before=structuredClone([...f.map]);
    assert.equal((await agent(f.context('files/'+id+'/rename','POST',{name:'b.png',dryRun:true}))).status,200);
    assert.equal((await agent(f.context('files/'+id+'/rename','POST',{name:'taken.png'}))).status,409);
    assert.equal((await agent(f.context('files/'+id+'/move','POST',{folder:'archive',expectedPath:'stale.png'}))).status,409);
    for(const folder of ['../x','/abs','bad//x','bad/','manage@identity/x','x\\y']) assert.equal((await agent(f.context('folders','POST',{path:folder}))).status,400,folder);
    for (const name of ['folder/name.png','manage@sysConfig@security','chunk_0']) assert.equal((await agent(f.context('files/'+id+'/rename','POST',{name}))).status,400);
    assert.equal((await agent(f.context('files/'+id+'/tags','POST',{tags:['bad tag']}))).status,400);
    assert.equal((await agent(f.context('folders','POST',{path:'new',dryRun:'true'}))).status,400);
    assert.deepEqual([...f.map],before);
});
test('agent rename/move/tags retain immutable identity and disclose only permitted fields',async()=>{
    const f=fixture(); const id=await addFile(f);const originalFetch=globalThis.fetch;
    globalThis.fetch=async()=>Response.json({success:true});
    const originalCaches=globalThis.caches;globalThis.caches={default:{delete:async()=>true,put:async()=>{}}};
    try {
        let response=await agent(f.context('files/'+id+'/rename','POST',{name:'新名字.png',expectedPath:'photos/a.png'}));
        assert.equal(response.status,200,await response.clone().text());
        let result=await response.json();assert.equal(result.file.id,id);assert.equal(result.file.path,'photos/新名字.png');
        response=await agent(f.context('files/'+id+'/move','POST',{folder:'归档/图片'}));
        assert.equal(response.status,200,await response.clone().text());
        result=await response.json();assert.equal(result.file.path,'归档/图片/新名字.png');assert.equal(result.file.id,id);
        response=await agent(f.context('files/'+id+'/tags','POST',{tags:['旅行','PHOTO']}));
        assert.equal(response.status,200);result=await response.json();assert.deepEqual(result.file.tags,['旧标签','旅行','photo']);
        const details=await (await agent(f.context('files/'+id))).json();
        assert.equal(details.url,'https://img.example/file/'+id);assert.equal(details.UploadIP,undefined);assert.equal(details.TgFileId,undefined);
        assert.equal((await agent(f.context('files/'+id+'/move','POST',{folder:'归档/图片'}))).status,200);
        await Promise.all(f.tasks);
    } finally {globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
test('empty folders appear in admin listing; folder and tag definitions persist and support dry run',async()=>{
    const f=fixture();
    assert.equal((await agent(f.context('folders','POST',{path:'归档/图片'}))).status,200);
    assert.deepEqual(await storedSubfolders(f.db,''),['归档']);
    assert.deepEqual(await storedSubfolders(f.db,'归档'),['归档/图片']);
    const result=await (await listFiles({...f.context(),request:new Request('https://img.example/api/manage/list')})).json();
    assert.ok(result.directories.includes('归档'));
    await updateFolderEntries(f.db,'归档','备份');assert.deepEqual(await storedSubfolders(f.db,'备份'),['备份/图片']);
    await updateFolderEntries(f.db,'备份');assert.deepEqual(await storedSubfolders(f.db,''),[]);
    await agent(f.context('tags','POST',{tags:['PHOTO','旅行']}));
    await agent(f.context('tags','POST',{tags:['预览'],dryRun:true}));
    const tags=await (await agent(f.context('tags'))).json();assert.ok(tags.tags.includes('photo'));assert.ok(tags.tags.includes('旅行'));assert.ok(!tags.tags.includes('预览'));
    await Promise.all(f.tasks);
});
test('OpenAPI exposes authenticated organization methods without destructive operations',()=>{
    const schema=agentOpenApi('https://img.example');assert.equal(schema.openapi,'3.0.3');
    assert.equal(schema.servers[0].url,'https://img.example/api/agent');
    for(const item of Object.values(schema.paths)) assert.ok(!item.delete && !item.put && !item.patch);
    assert.ok(validFolder('资料/2026'));assert.ok(validFolder('',true));
});


test('file listing returns stable IDs and only allowed fields, ignores admin action query',async()=>{
    const f=fixture();const id=await addFile(f);
    const response=await agent(f.context('files?count=100&recursive=true&action=delete-operations'));
    assert.equal(response.status,200);
    const result=await response.json();assert.equal(result.files.length,1);assert.equal(result.files[0].id,id);
    assert.equal(result.files[0].UploadIP,undefined);assert.equal(result.files[0].TgFileId,undefined);
    assert.equal(result.nextStart,null);await Promise.all(f.tasks);
});

test('recursive listing paginates even when falling back from an unavailable index',async()=>{
    const f=fixture();await addFile(f);await addFile(f,'photos/b.png');
    const response=await agent(f.context('files?recursive=true&count=1'));
    const result=await response.json();assert.equal(result.files.length,1);assert.equal(result.nextStart,1);
    await Promise.all(f.tasks);
    const next=await (await agent(f.context('files?recursive=true&count=1&start=1'))).json();
    assert.equal(next.files.length,1);assert.notEqual(next.files[0].id,result.files[0].id);await Promise.all(f.tasks);
});
