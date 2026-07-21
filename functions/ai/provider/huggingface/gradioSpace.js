const SPACE_REPOSITORY_HOST = 'huggingface.co';

/**
 * Resolve a Hugging Face Space repository page to its hosted Gradio origin.
 * Other endpoints are deliberately left to the provider's existing protocol.
 */
export function resolveHuggingFaceSpace(endpoint) {
    let url;
    try {
        url = new URL(String(endpoint || '').trim());
    } catch {
        return null;
    }

    if (url.hostname.toLowerCase() !== SPACE_REPOSITORY_HOST) return null;
    const match = url.pathname.match(/^\/spaces\/([^/]+)\/([^/]+)\/?$/i);
    if (!match) return null;

    const owner = decodeURIComponent(match[1]);
    const space = decodeURIComponent(match[2]);
    if (!owner || !space) return null;

    return {
        owner,
        space,
        origin: `https://${toSpaceHostnamePart(owner)}-${toSpaceHostnamePart(space)}.hf.space`
    };
}

export async function requestGradioSpace(options) {
    const {
        space,
        bytes,
        artifact,
        config,
        fetcher,
        headers,
        signal
    } = options;
    const gradioConfig = await fetchJson(fetcher, `${space.origin}/config`, {
        headers,
        signal
    });
    const dependency = selectDependency(gradioConfig);
    if (!dependency) {
        throw new GradioSpaceError('WD Tagger Space does not expose a compatible prediction function');
    }

    const majorVersion = Number.parseInt(String(gradioConfig.version || '3').split('.')[0], 10) || 3;
    const apiPrefix = normalizeApiPrefix(gradioConfig.api_prefix, majorVersion);
    const image = majorVersion >= 4
        ? await uploadImage({ fetcher, origin: space.origin, apiPrefix, bytes, artifact, headers, signal })
        : bytesToDataUrl(bytes, artifact.mimeType);
    const data = buildInputData(gradioConfig, dependency, image, config);
    const apiName = normalizeApiName(dependency.api_name);

    if (majorVersion >= 4 && apiName) {
        return callEventEndpoint({
            fetcher,
            url: `${space.origin}${apiPrefix}/call/${encodeURIComponent(apiName)}`,
            data,
            headers,
            signal
        });
    }

    const suffix = apiName ? `/${encodeURIComponent(apiName)}` : '';
    return fetchJson(fetcher, `${space.origin}${apiPrefix}/predict${suffix}`, {
        method: 'POST',
        headers: jsonHeaders(headers),
        body: JSON.stringify({ data, fn_index: dependency.index }),
        signal
    });
}

export class GradioSpaceError extends Error {
    constructor(message, options = {}) {
        super(message, options.cause ? { cause: options.cause } : undefined);
        this.name = 'GradioSpaceError';
        this.status = options.status || 0;
    }
}

function toSpaceHostnamePart(value) {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}

function selectDependency(config) {
    const components = new Map((config.components || []).map(component => [component.id, component]));
    const dependencies = (config.dependencies || []).map((dependency, index) => ({ ...dependency, index }));
    const candidates = dependencies.filter(dependency => {
        if (dependency.backend_fn === false) return false;
        return (dependency.inputs || []).some(id => isImageComponent(components.get(id)));
    });
    return candidates.find(dependency => /tag|predict/i.test(String(dependency.api_name || '')))
        || candidates[0]
        || null;
}

function buildInputData(config, dependency, image, providerConfig) {
    const components = new Map((config.components || []).map(component => [component.id, component]));
    return (dependency.inputs || []).map(id => {
        const component = components.get(id) || {};
        const type = String(component.type || '').toLowerCase();
        const label = String(component.props?.label || '').toLowerCase();
        if (isImageComponent(component)) return image;
        if (/character/.test(label) && /threshold|thresh/.test(label)) {
            return providerConfig.characterThreshold;
        }
        if (/general/.test(label) && /threshold|thresh/.test(label)) {
            return providerConfig.threshold;
        }
        if (/model/.test(label) || type === 'dropdown' && /repo/.test(label)) {
            return providerConfig.model || component.props?.value;
        }
        return component.props?.value ?? defaultComponentValue(type);
    });
}

function isImageComponent(component) {
    return String(component?.type || '').toLowerCase() === 'image'
        || /image/.test(String(component?.props?.label || '').toLowerCase());
}

function defaultComponentValue(type) {
    if (type === 'checkbox') return false;
    if (type === 'number' || type === 'slider') return 0;
    return null;
}

async function uploadImage(options) {
    const { fetcher, origin, apiPrefix, bytes, artifact, headers, signal } = options;
    const body = new FormData();
    const fileName = artifact.fileName || 'image';
    const mimeType = artifact.mimeType || 'application/octet-stream';
    body.append('files', new Blob([bytes], { type: mimeType }), fileName);
    const response = await fetcher(`${origin}${apiPrefix}/upload`, {
        method: 'POST',
        headers: formHeaders(headers),
        body,
        signal
    });
    const uploaded = await parseJsonResponse(response, 'WD Tagger Space image upload failed');
    const path = Array.isArray(uploaded) ? uploaded[0] : uploaded?.path;
    if (!path) throw new GradioSpaceError('WD Tagger Space returned an invalid upload result');
    return {
        path,
        url: `${origin}${apiPrefix}/file=${encodeURIComponent(path)}`,
        orig_name: fileName,
        size: bytes.byteLength,
        mime_type: mimeType,
        meta: { _type: 'gradio.FileData' }
    };
}

async function callEventEndpoint(options) {
    const { fetcher, url, data, headers, signal } = options;
    const submission = await fetchJson(fetcher, url, {
        method: 'POST',
        headers: jsonHeaders(headers),
        body: JSON.stringify({ data }),
        signal
    });
    if (!submission?.event_id) return submission;

    const response = await fetcher(`${url}/${encodeURIComponent(submission.event_id)}`, {
        headers,
        signal
    });
    if (!response.ok) throw statusError('WD Tagger Space event request failed', response.status);
    const body = await response.text();
    const completed = parseCompletedEvent(body);
    if (completed === undefined) {
        throw new GradioSpaceError('WD Tagger Space returned an incomplete event stream');
    }
    return { data: completed };
}

function parseCompletedEvent(body) {
    const blocks = String(body || '').split(/\r?\n\r?\n/);
    for (const block of blocks) {
        const lines = block.split(/\r?\n/);
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        if (event !== 'complete') continue;
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
        try {
            return JSON.parse(data);
        } catch (error) {
            throw new GradioSpaceError('WD Tagger Space returned invalid event data', { cause: error });
        }
    }
    return undefined;
}

function normalizeApiPrefix(value, majorVersion) {
    const fallback = majorVersion >= 4 ? '/gradio_api' : '/api';
    const prefix = String(value || fallback).trim();
    return `/${prefix.replace(/^\/+|\/+$/g, '')}`;
}

function normalizeApiName(value) {
    if (!value || value === false) return '';
    return String(value).replace(/^\/+|\/+$/g, '');
}

function bytesToDataUrl(bytes, mimeType = 'application/octet-stream') {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
}

async function fetchJson(fetcher, url, init) {
    const response = await fetcher(url, init);
    return parseJsonResponse(response, 'WD Tagger Space request failed');
}

async function parseJsonResponse(response, message) {
    if (!response.ok) throw statusError(message, response.status);
    try {
        return await response.json();
    } catch (error) {
        throw new GradioSpaceError(`${message}: invalid JSON`, { cause: error });
    }
}

function statusError(message, status) {
    return new GradioSpaceError(`${message} with status ${status}`, { status });
}

function jsonHeaders(input) {
    const headers = new Headers(input);
    headers.set('accept', 'application/json');
    headers.set('content-type', 'application/json');
    return headers;
}

function formHeaders(input) {
    const headers = new Headers(input);
    headers.delete('content-type');
    return headers;
}
