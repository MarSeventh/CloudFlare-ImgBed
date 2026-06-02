import { userAuthCheck, UnauthorizedResponse } from '../../utils/auth/userAuth.js';
import { createResponse } from '../uploadTools.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    try {
        const requiredPermission = 'upload';
        if (!await userAuthCheck(env, url, request, requiredPermission)) {
            return UnauthorizedResponse('Unauthorized');
        }

        const target = url.searchParams.get('target');
        if (!target) {
            return createResponse(JSON.stringify({ error: 'Missing target URL' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const targetUrl = new URL(target);
        if (targetUrl.protocol !== 'https:' ||
            targetUrl.hostname !== 'huggingface.co' ||
            targetUrl.pathname !== '/api/complete_multipart') {
            return createResponse(JSON.stringify({ error: 'Invalid multipart completion target' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await request.text();
        validateMultipartBody(body);

        const completeResponse = await fetch(targetUrl.toString(), {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.git-lfs+json',
                'Content-Type': 'application/vnd.git-lfs+json'
            },
            body
        });

        const responseText = await completeResponse.text();
        if (!completeResponse.ok) {
            return createResponse(responseText || `Multipart complete failed: ${completeResponse.status}`, {
                status: completeResponse.status
            });
        }

        return createResponse(responseText || JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('completeMultipart error:', error.message);
        return createResponse(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

function validateMultipartBody(body) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    } catch {
        throw new Error('Invalid multipart completion body');
    }

    if (!parsed || typeof parsed.oid !== 'string' || !Array.isArray(parsed.parts)) {
        throw new Error('Invalid multipart completion payload');
    }

    const hasInvalidPart = parsed.parts.some(part =>
        !part ||
        !Number.isInteger(Number(part.partNumber)) ||
        Number(part.partNumber) <= 0 ||
        typeof part.etag !== 'string' ||
        part.etag.length === 0
    );

    if (hasInvalidPart) {
        throw new Error('Invalid multipart parts');
    }
}
