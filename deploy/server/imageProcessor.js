import sharp from 'sharp';

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_INPUT_PIXELS = 25_000_000;

const maxInputPixels = readPositiveInteger(
    process.env.IMAGE_TRANSFORM_MAX_PIXELS,
    DEFAULT_MAX_INPUT_PIXELS
);
const concurrency = Math.min(
    readPositiveInteger(process.env.IMAGE_TRANSFORM_CONCURRENCY, 1),
    8
);

// Limit native memory and parallel decoding so concurrent large requests do not
// unexpectedly exhaust a small Docker container.
sharp.cache({ memory: 32, files: 0, items: 32 });
sharp.concurrency(concurrency);

export const dockerImageProcessor = {
    async transform(stream, options) {
        const input = await readStreamWithLimit(stream, MAX_INPUT_BYTES);

        // SVG is inherently scalable. Keep the source document unchanged,
        // matching Cloudflare Image Transformations behavior.
        if (options.sourceType === 'image/svg+xml') {
            return new Response(input, {
                headers: {
                    'Content-Type': options.sourceType,
                    'Content-Length': input.byteLength.toString(),
                },
            });
        }

        const animated = options.sourceType === 'image/gif' || options.sourceType === 'image/webp';

        let pipeline = sharp(input, {
            animated,
            failOn: 'error',
            limitInputPixels: maxInputPixels,
            sequentialRead: true,
        }).autoOrient().resize({
            width: options.width,
            height: options.height,
            fit: resolveSharpFit(options.fit),
            withoutEnlargement: !options.fit,
        });

        pipeline = applyOutputFormat(pipeline, options.outputFormat);
        const output = await pipeline.toBuffer();

        return new Response(output, {
            headers: {
                'Content-Type': options.outputFormat,
                'Content-Length': output.byteLength.toString(),
            },
        });
    },
};

function resolveSharpFit(fit) {
    if (fit === 'cover') return 'cover';
    if (fit === 'squeeze') return 'fill';
    return 'inside';
}

function applyOutputFormat(pipeline, outputFormat) {
    switch (outputFormat) {
        case 'image/jpeg':
            return pipeline.jpeg();
        case 'image/png':
            return pipeline.png();
        case 'image/webp':
            return pipeline.webp();
        case 'image/avif':
            return pipeline.avif();
        case 'image/gif':
            return pipeline.gif();
        default:
            throw new Error(`Unsupported Docker image output format: ${outputFormat}`);
    }
}

async function readStreamWithLimit(stream, maxBytes) {
    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of stream) {
        const buffer = Buffer.from(chunk);
        totalBytes += buffer.byteLength;
        if (totalBytes > maxBytes) {
            const error = new Error('Image resizing supports source files up to 20 MB');
            error.statusCode = 413;
            throw error;
        }
        chunks.push(buffer);
    }

    return Buffer.concat(chunks, totalBytes);
}

function readPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
