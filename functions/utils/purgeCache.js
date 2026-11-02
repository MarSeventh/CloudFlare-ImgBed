import { fetchOthersConfig } from "./sysConfig";
import { getDatabase } from './databaseAdapter.js';
import { getReferencePaths } from './fileIdentity.js';

let othersConfig = {};
let cfZoneId = "";
let cfEmail = "";
let cfApiKey = "";

export async function purgeCFCache(env, cdnUrl) {
    try {
        // 读取其他设置
        othersConfig = await fetchOthersConfig(env);
        cfZoneId = othersConfig.cloudflareApiToken.CF_ZONE_ID;
        cfEmail = othersConfig.cloudflareApiToken.CF_EMAIL;
        cfApiKey = othersConfig.cloudflareApiToken.CF_API_KEY;

        // 如果没有配置Cloudflare API，跳过缓存清除
        if (!cfZoneId || !cfEmail || !cfApiKey) {
            return 'unconfigured';
        }

        // 清除CDN缓存
        const originalUrl = new URL(cdnUrl);
        const path = decodeURIComponent(originalUrl.pathname.replace(/^\/file\//, ''));
        const references = await getReferencePaths(getDatabase(env), path);
        const files = [...new Set([cdnUrl, ...references.map(reference =>
            `${originalUrl.origin}/file/${reference.split('/').map(encodeURIComponent).join('/')}`)])];
        const options = {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-Auth-Email': `${cfEmail}`, 'X-Auth-Key': `${cfApiKey}`},
            body: ''
        };
        for (let start = 0; start < files.length; start += 30) {
            options.body = JSON.stringify({ files: files.slice(start, start + 30) });
            const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${ cfZoneId }/purge_cache`, options);
            if (!response.ok || (await response.json()).success === false) throw new Error('Cloudflare cache purge failed');
        }
    } catch (error) {
        console.error('Failed to purge CF cache:', error.message || error);
        return false;
    }
}

export async function purgeRandomFileListCache(origin, ...dirs) {
    try {
        const cache = caches.default;
        // cache.delete有bug，通过写入一个max-age=0的response来清除缓存
        const nullResponse = new Response(null, {
            headers: { 'Cache-Control': 'max-age=0' },
        });

        for (const dir of dirs) {
            await cache.put(`${origin}/api/randomFileList?dir=${dir}`, nullResponse);
        }
    } catch (error) {
        console.error('Failed to clear randomFileList cache:', error);
        return false;
    }
}

export async function purgePublicFileListCache(origin, ...dirs) {
    try {
        const cache = caches.default;
        // cache.delete有bug，通过写入一个max-age=0的response来清除缓存
        const nullResponse = new Response(null, {
            headers: { 'Cache-Control': 'max-age=0' },
        });

        for (const dir of dirs) {
            // 清除递归和非递归两种缓存
            await cache.put(`${origin}/api/publicFileList?dir=${dir}&recursive=false`, nullResponse);
            await cache.put(`${origin}/api/publicFileList?dir=${dir}&recursive=true`, nullResponse);
        }
    } catch (error) {
        console.error('Failed to clear publicFileList cache:', error);
        return false;
    }
}
