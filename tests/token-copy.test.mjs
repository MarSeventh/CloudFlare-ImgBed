import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as copyKey} from '../functions/api/manage/apiTokens/copy.js';
import {onRequest as tokens} from '../functions/api/manage/apiTokens.js';
function fixture() {
    const map=new Map();
    map.set('manage@sysConfig@security',JSON.stringify({apiTokens:{tokens:{
        existing:{id:'existing',token:'imgbed_test_only_complete_key_1234567890',type:'user',permissions:['organize']},
        hidden:{id:'hidden',token:'internal_test_key',type:'internal'},
        expired:{id:'expired',token:'expired_test_key',autoDelete:true,expiresAt:'2000-01-01'}
    }}}));
    for(const authType of ['admin','user']) map.set('manage@session@'+authType,JSON.stringify({authType,expiresAt:Date.now()+60000}));
    map.set('manage@session@expired',JSON.stringify({authType:'admin',expiresAt:1}));
    const env={img_url:{get:async key=>map.get(key)??null,put:async(key,value)=>map.set(key,value),delete:async key=>map.delete(key)}};
    const context=(headers={},body={tokenId:'existing'},method='POST')=>({env,request:new Request('https://img.example/api/manage/apiTokens/copy',{method,headers:{'Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})})});
    return {env,map,context};
}
test('copy requires a current administrator session, not a user session or delegated token',async()=>{
    const f=fixture();
    for(const headers of [{},{Cookie:'user_session=user'},{Authorization:'Bearer imgbed_test_only_complete_key_1234567890'},{Cookie:'admin_session=user'},{Cookie:'admin_session=expired'}]) {
        const response=await copyKey(f.context(headers));assert.equal(response.status,403);assert.ok(!JSON.stringify(await response.json()).includes('imgbed_'));
    }
});
test('admin can copy an existing complete key on demand while ordinary list remains masked',async()=>{
    const f=fixture();const response=await copyKey(f.context({Cookie:'admin_session=admin'}));
    assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
    assert.equal((await response.json()).token,'imgbed_test_only_complete_key_1234567890');
    const listing=await tokens({...f.context(),request:new Request('https://img.example/api/manage/apiTokens')});
    const text=await listing.text();assert.ok(!text.includes('imgbed_test_only_complete_key_1234567890'));assert.ok(!text.includes('internal_test_key'));
});
test('missing, revoked and hidden keys are not revealed; only POST is accepted',async()=>{
    const f=fixture();const headers={Cookie:'admin_session=admin'};
    for(const tokenId of ['missing','hidden','expired','__proto__']) assert.equal((await copyKey(f.context(headers,{tokenId}))).status,404);
    assert.equal((await copyKey(f.context(headers,{}))).status,400);
    assert.equal((await copyKey(f.context(headers,null,'GET'))).status,405);
    const settings=JSON.parse(f.map.get('manage@sysConfig@security'));delete settings.apiTokens.tokens.existing;f.map.set('manage@sysConfig@security',JSON.stringify(settings));
    assert.equal((await copyKey(f.context(headers))).status,404);
});
