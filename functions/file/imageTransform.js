const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;

const OUTPUT_FORMATS = new Map([
    ['image/jpeg', 'image/jpeg'],
    ['image/jpg', 'image/jpeg'],
    ['image/png', 'image/png'],
    ['image/webp', 'image/webp'],
    ['image/avif', 'image/avif'],
    // Images binding does not encode GIF or SVG. WebP preserves GIF animation
    // while PNG preserves SVG transparency.
    ['image/gif', 'image/webp'],
    ['image/svg+xml', 'image/png'],
]);

export function parseImageTransform(url, accessConfig = {}) {
    const widthResult = parseDimension(url.searchParams, 'width');
    const heightResult = parseDimension(url.searchParams, 'height');
    const fitResult = parseFit(url.searchParams);

    if (widthResult.error || heightResult.error || fitResult.error) {
        return {
            requested: true,
            error: widthResult.error || heightResult.error || fitResult.error,
        };
    }

    const requested = widthResult.present || heightResult.present || fitResult.present;
    if (!requested) {
        return { requested: false };
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

export async function transformImageResponse(context, response) {
    const imageTransform = context.imageTransform;
    if (!imageTransform?.requested || response.status !== 200 || !response.body) {
        return response;
    }

    const contentLength = parseContentLength(response.headers.get('Content-Length'));
    if (contentLength !== null && contentLength > MAX_IMAGE_INPUT_BYTES) {
        return imageTransformError('Image resizing supports source files up to 20 MB', 413);
    }

    const sourceType = normalizeContentType(response.headers.get('Content-Type'));
    const outputFormat = OUTPUT_FORMATS.get(sourceType);
    if (!outputFormat) {
        return imageTransformError(`Unsupported image type: ${sourceType || 'unknown'}`, 415);
    }

    try {
        const transformed = await runImageTransform(
            context.env,
            response.body,
            imageTransform.options,
            sourceType,
            outputFormat
        );
        const headers = mergeTransformedHeaders(response.headers, transformed.headers, outputFormat);

        return new Response(transformed.body, {
            status: transformed.status,
            statusText: transformed.statusText,
            headers,
        });
    } catch (error) {
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
