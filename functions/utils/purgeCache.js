import { fetchOthersConfig } from "./sysConfig";

let othersConfig = {};
let cfZoneId = "";
let cfEmail = "";
let cfApiKey = "";

export async function purgeCFCache(env, cdnUrl) {
    // 读取其他设置
    othersConfig = await fetchOthersConfig(env);
    cfZoneId = othersConfig.cloudflareApiToken.CF_ZONE_ID;
    cfEmail = othersConfig.cloudflareApiToken.CF_EMAIL;
    cfApiKey = othersConfig.cloudflareApiToken.CF_API_KEY;

    // 清除CDN缓存
    const options = {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Auth-Email': `${cfEmail}`, 'X-Auth-Key': `${cfApiKey}`},
        body: `{"files":["${ cdnUrl }"]}`
    };
    await fetch(`https://api.cloudflare.com/client/v4/zones/${ cfZoneId }/purge_cache`, options);
}