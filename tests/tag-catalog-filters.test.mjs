import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as catalog } from '../functions/api/manage/tags/catalog.js';
import { onRequest as list } from '../functions/api/manage/list.js';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { rebuildIndex } from '../functions/utils/indexManager.js';
function fixture() {
 const map=new Map(); const env={img_url:{get:async k=>map.get(k)?.value??null,getWithMetadata:async k=>structuredClone(map.get(k)||{value:null,metadata:null}),put:async(k,value,o={})=>map.set(k,structuredClone({value,metadata:o.metadata})),delete:async k=>map.delete(k),list:async({prefix='',cursor='',limit=1000}={})=>{const keys=[...map.keys()].sort().filter(k=>k.startsWith(prefix)&&k>(cursor || ''));const page=keys.slice(0,limit);return {keys:page.map(name=>({name,metadata:map.get(name).metadata})),list_complete:keys.length<=limit,cursor:keys.length<=limit ? undefined : page.at(-1)};}}};const tasks=[];
 const context=(method='GET',body,url='https://example.test/api/manage/tags/catalog')=>({env,waitUntil:p=>tasks.push(p),request:new Request(url,{method,...(body?{body:JSON.stringify(body)}:{})})});return {map,db:getDatabase(env),context,tasks};
}
async function file(f,name,tags,type='image/png'){await f.db.put(name,'original',{metadata:{FileName:name,Directory:'',FileType:type,Tags:tags,TimeStamp:1}});}
test('catalog add/delete and rename preserve identity and merge duplicates',async()=>{
 const f=fixture();await file(f,'a.png',['old','dest']);await file(f,'b.png',['old']);const id=(await f.db.getWithMetadata('a.png')).metadata.FixedId;
 assert.equal((await catalog(f.context('POST',{action:'add',name:'Future'}))).status,200);
 assert.equal((await catalog(f.context('POST',{action:'delete',name:'old'}))).status,409);
 assert.equal((await catalog(f.context('POST',{action:'delete',name:'future'}))).status,200);
 let cursor,count=0;do{const r=await(await catalog(f.context('POST',{action:'rename',name:'old',newName:'dest',cursor}))).json();cursor=r.nextCursor;count+=r.updated;}while(cursor);
 assert.equal(count,2);const a=await f.db.getWithMetadata('a.png');assert.deepEqual(a.metadata.Tags,['dest']);assert.equal(a.metadata.FixedId,id);assert.equal(a.value,'original');assert.deepEqual((await(await catalog(f.context())).json()).tags,[{name:'dest',count:2}]);
 for(const body of [{action:'rename',name:'dest',newName:'bad tag'},{action:'add',name:'../x'},{action:'delete',name:3}])assert.equal((await catalog(f.context('POST',body))).status,400);await Promise.all(f.tasks);
});
test('catalog scans beyond first storage page',async()=>{const f=fixture();for(let i=0;i<1005;i++)f.map.set('file'+String(i).padStart(4,'0'),{value:'',metadata:{Tags:[i===1004?'last':'first']}});const tags=(await(await catalog(f.context())).json()).tags;assert.equal(tags.find(t=>t.name==='last').count,1);assert.equal(tags.find(t=>t.name==='first').count,1004);});
test('OR within groups, AND between tag groups and file types before pagination',async()=>{
 const f=fixture();await file(f,'a.png',['red','travel']);await file(f,'b.mp4',['blue','travel'],'video/mp4');await file(f,'c.mp3',['red','travel'],'audio/mpeg');await file(f,'d.png',['red','work']);await file(f,'e.png',[]);await rebuildIndex(f.context());
 const query='https://example.test/api/manage/list?tagGroup1=red,blue&tagGroup2=travel,holiday&fileType=image,video&count=1';let r=await(await list(f.context('GET',null,query))).json();assert.equal(r.totalCount,2);assert.equal(r.directFileCount,2);assert.equal(r.files.length,1);const first=r.files[0].name;r=await(await list(f.context('GET',null,query+'&start=1'))).json();assert.equal(r.files.length,1);assert.notEqual(r.files[0].name,first);r=await(await list(f.context('GET',null,'https://example.test/api/manage/list?tagGroup2=work'))).json();assert.equal(r.totalCount,1);assert.equal(r.files[0].name,'d.png');await Promise.all(f.tasks);
});

test('rename continues across batches and safely repeats after interruption',async()=>{
 const f=fixture();for(let i=0;i<35;i++)await file(f,'p'+String(i).padStart(3,'0')+'.png',['old']);
 let r=await(await catalog(f.context('POST',{action:'rename',name:'old',newName:'new'}))).json();assert.ok(r.nextCursor);
 // Restart from the beginning, as the UI recommends after an interrupted request.
 let cursor;do{r=await(await catalog(f.context('POST',{action:'rename',name:'old',newName:'new',cursor}))).json();cursor=r.nextCursor;}while(cursor);
 const tags=(await(await catalog(f.context())).json()).tags;assert.deepEqual(tags,[{name:'new',count:35}]);await Promise.all(f.tasks);
});
test('PDF filter recognizes MIME and generic uploads, combines with tags and excludes PDFs from other',async()=>{
 const f=fixture();await file(f,'manual.pdf',['work'],'application/pdf');await file(f,'scan.PDF',['travel'],'application/octet-stream');await file(f,'legacy.pdf',['work'],'');await file(f,'notes.txt',['work'],'text/plain');await file(f,'photo.png',['work'],'image/png');await rebuildIndex(f.context());
 const names=async query=>(await(await list(f.context('GET',null,'https://example.test/api/manage/list?'+query))).json()).files.map(f=>f.name).sort();
 assert.deepEqual(await names('fileType=pdf'),['legacy.pdf','manual.pdf','scan.PDF']);
 assert.deepEqual(await names('fileType=other'),['notes.txt']);
 assert.deepEqual(await names('fileType=pdf,image&tagGroup1=work'),['legacy.pdf','manual.pdf','photo.png']);await Promise.all(f.tasks);
});
