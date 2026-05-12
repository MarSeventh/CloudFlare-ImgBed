import { dualAuthCheck } from '../utils/auth/dualAuth.js';
import { getUploadIp } from '../upload/uploadTools.js';

export async function onRequest(context) {
    // 获取请求体中URL的内容
    const {
        request,
        env,
        params,
        waitUntil,
        next,
        data
    } = context;

    // 双重鉴权检查
    const url = new URL(request.url);
    const { authorized } = await dualAuthCheck(env, url, request);
    if (!authorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const uploadIp = getUploadIp(request);
    const allowedUploadIps = (env.ALLOWED_UPLOAD_IPS || "")
        .split(",")
        .map(ip => ip.trim())
        .filter(Boolean);

    if (allowedUploadIps.length > 0 && !allowedUploadIps.includes(uploadIp)) {
        return new Response(JSON.stringify({ error: 'Upload IP is not allowed' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const jsonRequest = await request.json();
    const targetUrl = jsonRequest.url;
    if (targetUrl === undefined) {
        return new Response('URL is required', { status: 400 })
    }
    const response = await fetch(targetUrl);
    const headers = new Headers(response.headers);
    return new Response(response.body, {
        headers: headers
    })
}
