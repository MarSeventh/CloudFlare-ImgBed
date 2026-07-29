const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;

const OUTPUT_FORMATS = new Map([
    ['image/jpeg', 'image/jpeg'],
    ['image/jpg', 'image/jpeg'],
    ['image/png', 'image/png'],
    ['image/webp', 'image/webp'],
    ['image/avif', 'image/avif'],
    ['image/gif', 'image/gif'],
]);

const IMAGE_TYPES_BY_EXTENSION = new Map([
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['jpe', 'image/jpeg'],
    ['jfif', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['avif', 'image/avif'],
    ['gif', 'image/gif'],
    ['svg', 'image/svg+xml'],
    ['svgz', 'image/svg+xml'],
]);

export function parseImageTransform(url, accessConfig = {}) {
    const widthResult = parseDimension(url.searchParams, 'width');
    const heightResult = parseDimension(url.searchParams, 'height');
    const fitResult = parseFit(url.searchParams);
    const fallbackResult = parseFallback(url.searchParams);

    if (widthResult.error || heightResult.error || fitResult.error || fallbackResult.error) {
        return {
            requested: true,
            error: widthResult.error || heightResult.error || fitResult.error || fallbackResult.error,
        };
    }

    const requested = widthResult.present || heightResult.present || fitResult.present || fallbackResult.present;
    if (!requested) {
        return { requested: false };
    }

    if (fallbackResult.present && !widthResult.present && !heightResult.present && !fitResult.present) {
        return {
            requested: true,
            error: 'fallback=original requires image resizing parameters',
        };
    }

    if (accessConfig.imageTransformEnabled !== true) {
        return {
            requested: true,
            error: 'Image resizing is disabled',
            errorStatus: 403,
        };
    }

    const width = widthResult.value;
    const height = heightResult.value;
    const fit = fitResult.value;

    if (fit && (!width || !height)) {
        return {
            requested: true,
            error: `fit=${fit} requires both width and height`,
        };
    }

    const sizeKey = `${width || 'auto'}x${height || 'auto'}`;
    const allowedSizes = parseAllowedSizes(accessConfig.imageTransformAllowedSizes);

    if (allowedSizes.size > 0 && !allowedSizes.has(sizeKey)) {
        return {
            requested: true,
            error: `Image size ${sizeKey} is not allowed`,
        };
    }

    return {
        requested: true,
        sizeKey,
        fallback: fallbackResult.value,
        options: {
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
            ...(fit ? { fit } : {}),
        },
    };
}

export function validateImageTransformRequest(request, imageTransform) {
    if (!imageTransform.requested) return null;

    if (imageTransform.error) {
        return imageTransformError(imageTransform.error, imageTransform.errorStatus || 400);
    }

    if (request.method !== 'GET') {
        return imageTransformError('Image resizing only supports GET requests', 405, {
            Allow: 'GET',
        });
    }

    if (request.headers.has('Range')) {
        return imageTransformError('Range requests cannot be combined with image resizing', 400);
    }

    return null;
}

export function validateImageTransformSource(imageTransform, env, fileType, fileName) {
    if (!imageTransform?.requested) {
        return null;
    }

    const metadataType = normalizeContentType(fileType);
    const inferredType = metadataType || inferImageTypeFromFileName(fileName);
    if (!inferredType || canTransformImageType(env, inferredType)) {
        return null;
    }

    if (imageTransform.fallback === 'original') {
        return { fallbackToOriginal: true };
    }

    return {
        response: imageTransformError(`Unsupported image type: ${inferredType}`, 415),
    };
}

export async function transformImageRequestViaUrl(context) {
    const { env, imageTransform, request } = context;
    if (!imageTransform?.requested || hasConfiguredImageProcessor(env)) {
        return null;
    }

    // Image Resizing fetches the source through this same file route. Never
    // start another transformation for that internal source request.
    if (/image-resizing/i.test(request.headers.get('Via') || '')) {
        return null;
    }

    const sourceUrl = new URL(request.url);
    sourceUrl.searchParams.delete('width');
    sourceUrl.searchParams.delete('height');
    sourceUrl.searchParams.delete('fit');
    sourceUrl.searchParams.delete('fallback');

    const transformOptions = Object.entries({
        ...imageTransform.options,
        ...(imageTransform.fallback === 'original' ? { onerror: 'redirect' } : {}),
    })
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join(',');
    const transformUrl = new URL(
        `/cdn-cgi/image/${transformOptions}${sourceUrl.pathname}${sourceUrl.search}`,
        sourceUrl.origin
    );

    return new Response(null, {
        status: 302,
        headers: {
            'Location': transformUrl.toString(),
            'Cache-Control': 'private, no-store, max-age=0',
        },
    });
}

export async function transformImageResponse(context, response) {
    const imageTransform = context.imageTransform;
    if (!imageTransform?.requested || response.status !== 200 || !response.body) {
        return response;
    }

    const sourceType = normalizeContentType(response.headers.get('Content-Type'));
    const outputFormat = OUTPUT_FORMATS.get(sourceType);
    if (!canTransformImageType(context.env, sourceType)) {
        if (imageTransform.fallback === 'original') {
            return response;
        }
        return imageTransformError(`Unsupported image type: ${sourceType || 'unknown'}`, 415);
    }

    const contentLength = parseContentLength(response.headers.get('Content-Length'));
    if (contentLength !== null && contentLength > MAX_IMAGE_INPUT_BYTES) {
        if (imageTransform.fallback === 'original') {
            return response;
        }
        return imageTransformError('Image resizing supports source files up to 20 MB', 413);
    }

    const fallbackResponse = imageTransform.fallback === 'original' ? response.clone() : null;

    try {
        const transformed = await runImageTransform(
            context.env,
            response.body,
            imageTransform.options,
            sourceType,
            outputFormat
        );
        if (fallbackResponse && !transformed.ok) {
            return fallbackResponse;
        }
        if (fallbackResponse?.body) {
            await fallbackResponse.body.cancel().catch(() => {});
        }
        const headers = mergeTransformedHeaders(response.headers, transformed.headers, outputFormat);

        return new Response(transformed.body, {
            status: transformed.status,
            statusText: transformed.statusText,
            headers,
        });
    } catch (error) {
        if (fallbackResponse) {
            return fallbackResponse;
        }

        const hasExplicitStatus = Number.isInteger(error.statusCode);
        if (!hasExplicitStatus) {
            console.error('Image transformation failed:', error);
        }
        const status = hasExplicitStatus ? error.statusCode : 422;
        return imageTransformError(`Image transformation failed: ${error.message || 'unknown error'}`, status);
    }
}

async function runImageTransform(env, stream, options, sourceType, outputFormat) {
    const images = env?.IMAGES;
    if (images && typeof images.input === 'function') {
        const output = await images
            .input(stream)
            .transform(options)
            .output({
                format: outputFormat,
                ...(sourceType === 'image/gif' ? { anim: true } : {}),
            });
        return output.response();
    }

    const processor = env?.IMAGE_PROCESSOR;
    if (processor && typeof processor.transform === 'function') {
        return await processor.transform(stream, {
            ...options,
            sourceType,
            outputFormat,
        });
    }

    const error = new Error('no image processor is configured');
    error.statusCode = 501;
    throw error;
}

function hasConfiguredImageProcessor(env) {
    const images = env?.IMAGES;
    if (images && typeof images.input === 'function') {
        return true;
    }

    return hasConfiguredStreamImageProcessor(env);
}

function hasConfiguredStreamImageProcessor(env) {
    const processor = env?.IMAGE_PROCESSOR;
    return Boolean(processor && typeof processor.transform === 'function');
}

function canTransformImageType(env, sourceType) {
    if (!OUTPUT_FORMATS.has(sourceType)) {
        return false;
    }

    if (sourceType === 'image/gif') {
        return hasConfiguredStreamImageProcessor(env);
    }

    if (sourceType === 'image/avif') {
        return hasConfiguredImageProcessor(env);
    }

    return true;
}

function parseDimension(searchParams, name) {
    const values = searchParams.getAll(name);
    if (values.length === 0) return { present: false, value: null };
    if (values.length !== 1) return { present: true, error: `Duplicate ${name} parameter` };

    const rawValue = values[0];
    if (!/^[1-9]\d*$/.test(rawValue)) {
        return { present: true, error: `${name} must be a positive integer` };
    }

    const value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value > MAX_IMAGE_DIMENSION) {
        return { present: true, error: `${name} must be between 1 and ${MAX_IMAGE_DIMENSION}` };
    }

    return { present: true, value };
}

function parseFit(searchParams) {
    const values = searchParams.getAll('fit');
    if (values.length === 0) return { present: false, value: null };
    if (values.length !== 1) return { present: true, error: 'Duplicate fit parameter' };
    if (values[0] !== 'cover' && values[0] !== 'squeeze') {
        return { present: true, error: 'fit must be cover or squeeze' };
    }

    return { present: true, value: values[0] };
}

function parseFallback(searchParams) {
    const values = searchParams.getAll('fallback');
    if (values.length === 0) return { present: false, value: null };
    if (values.length !== 1) return { present: true, error: 'Duplicate fallback parameter' };
    if (values[0] !== 'original') {
        return { present: true, error: 'fallback must be original' };
    }

    return { present: true, value: values[0] };
}

function parseAllowedSizes(value) {
    if (typeof value !== 'string' || value.trim() === '') return new Set();

    return new Set(
        value
            .split(',')
            .map(size => size.trim().toLowerCase())
            .filter(Boolean)
    );
}

function normalizeContentType(contentType) {
    return (contentType || '').split(';', 1)[0].trim().toLowerCase();
}

function inferImageTypeFromFileName(fileName) {
    if (typeof fileName !== 'string') return null;

    const match = /\.([^.\/\\]+)$/.exec(fileName.trim());
    if (!match) return null;

    return IMAGE_TYPES_BY_EXTENSION.get(match[1].toLowerCase()) || 'unknown';
}

function parseContentLength(value) {
    if (!value || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function mergeTransformedHeaders(sourceHeaders, transformedHeaders, outputFormat) {
    const headers = new Headers(sourceHeaders);

    headers.delete('Content-Length');
    headers.delete('Content-Range');
    headers.delete('Accept-Ranges');
    headers.delete('ETag');
    removeVaryToken(headers, 'Range');

    for (const name of ['Content-Length', 'ETag']) {
        const value = transformedHeaders.get(name);
        if (value) headers.set(name, value);
    }

    headers.set('Content-Type', transformedHeaders.get('Content-Type') || outputFormat);
    return headers;
}

function removeVaryToken(headers, tokenToRemove) {
    const vary = headers.get('Vary');
    if (!vary) return;

    const remaining = vary
        .split(',')
        .map(token => token.trim())
        .filter(token => token && token.toLowerCase() !== tokenToRemove.toLowerCase());

    if (remaining.length > 0) {
        headers.set('Vary', remaining.join(', '));
    } else {
        headers.delete('Vary');
    }
}

function imageTransformError(message, status, extraHeaders = {}) {
    return new Response(message, {
        status,
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Cache-Control': 'private, no-store, max-age=0',
            ...extraHeaders,
        },
    });
}
