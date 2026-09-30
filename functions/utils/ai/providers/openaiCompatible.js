import { APIError, readBoundedBody } from '../../apiResponse.js';
import { validateProviderURL } from '../config.js';

async function authenticationDetails(response, apiKey) {
    const safeIdentifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value) && !value.includes(apiKey) ? value : '';
    let value;
    if (response.headers.get('Content-Type')?.includes('application/json')) {
        try { value = JSON.parse(new TextDecoder().decode(await readBoundedBody(response, 8 * 1024))); }
        catch { /* Only bounded, structured identifiers are included in errors. */ }
    } else { await response.body?.cancel(); }
    const code = safeIdentifier(value?.error?.code);
    const type = safeIdentifier(value?.error?.type);
    const requestId = safeIdentifier(response.headers.get('x-request-id')) || safeIdentifier(value?.request_id);
    return { ...(code ? { code } : {}), ...(type ? { type } : {}), ...(requestId ? { requestId } : {}) };
}

export async function callOpenAICompatible({ provider, model, apiKey, prompt, image, signal, env, fetcher = fetch }) {
    const baseUrl = validateProviderURL(provider.baseUrl, env);
    const content = image ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image, detail: 'low' } }
    ] : prompt;
    const body = {
        model: model.model, messages: [{ role: 'user', content }], max_tokens: model.maxOutputTokens,
        ...(image && model.structuredOutput === 'json' ? { response_format: { type: 'json_object' } } : {})
    };
    const response = await fetcher(`${baseUrl}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body), redirect: 'manual', signal
    });
    if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new APIError('PROVIDER_REDIRECT', 'Provider endpoint redirected. Use its final API Base URL.', 502);
    }
    if (!response.ok) {
        if (response.status === 401) {
            const details = await authenticationDetails(response, apiKey);
            throw new APIError('PROVIDER_AUTH', 'Provider or its upstream service rejected authentication (HTTP 401).', 502, details);
        }
        if (response.status === 403) {
            const challenged = response.headers.get('cf-mitigated') === 'challenge';
            let securityPage = false;
            if (response.headers.get('Content-Type')?.includes('text/html')) {
                try {
                    const page = new TextDecoder().decode(await readBoundedBody(response, 8 * 1024));
                    securityPage = /cf-chl-|Cloudflare Ray ID|Just a moment|Attention Required/i.test(page);
                } catch { /* Error pages remain bounded and are never returned to the client. */ }
            } else { await response.body?.cancel(); }
            if (challenged || securityPage) throw new APIError('PROVIDER_BLOCKED', 'Provider security protection blocked this request (HTTP 403). Check its firewall or WAF rules for the API endpoint.', 502);
            throw new APIError('PROVIDER_FORBIDDEN', 'Provider denied this request (HTTP 403). Check model/image permissions and provider access rules.', 502);
        }
        await response.body?.cancel();
        if (response.status === 429) throw new APIError('PROVIDER_RATE_LIMIT', 'Provider rate limit reached. Retry later.', 429);
        throw new APIError('PROVIDER_ERROR', `Provider returned HTTP ${response.status}. Check the model and endpoint.`, 502, { status: response.status });
    }
    let value;
    try { value = JSON.parse(new TextDecoder().decode(await readBoundedBody(response, 64 * 1024))); }
    catch (error) {
        if (signal.aborted) throw error;
        throw new APIError('INVALID_RESPONSE', 'Provider response is invalid or too large.', 502);
    }
    const choice = value?.choices?.[0];
    if (typeof choice?.message?.content !== 'string' || choice.finish_reason === 'length') throw new APIError('INVALID_RESPONSE', 'Provider returned empty or truncated output.', 502);
    const usage = value.usage;
    return { text: choice.message.content, usage: usage ? {
        inputTokens: Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : null,
        outputTokens: Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : null
    } : null };
}
