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

        let targetUrl;
        try {
            targetUrl = new URL(target);
        } catch {
            return jsonError('Invalid multipart completion target', 400);
        }

        if (!isValidCompletionTarget(targetUrl)) {
            return jsonError('Invalid multipart completion target', 400);
        }

        const body = await request.text();
        try {
            validateMultipartBody(body);
        } catch (error) {
            return jsonError(error.message, 400);
        }

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
            const contentType = completeResponse.headers.get('Content-Type') || 'application/json';
            const errorBody = responseText || JSON.stringify({
                error: `Multipart complete failed: ${completeResponse.status}`
            });
            return createResponse(errorBody, {
                status: completeResponse.status,
                headers: { 'Content-Type': contentType }
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

function jsonError(message, status) {
    return createResponse(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function isValidCompletionTarget(targetUrl) {
    return targetUrl.protocol === 'https:' &&
        targetUrl.hostname === 'huggingface.co' &&
        targetUrl.pathname === '/api/complete_multipart';
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
