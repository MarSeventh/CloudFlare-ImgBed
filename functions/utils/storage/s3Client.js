import { S3Client } from '@aws-sdk/client-s3';

export function normalizeS3UserAgent(value) {
    if (value == null) return '';
    if (typeof value !== 'string' || /[^\x20-\x7e]/.test(value)) {
        throw new Error('S3 User-Agent must contain printable ASCII characters only');
    }
    return value.trim();
}

// All S3 operations share channel settings, including providers that bind keys to a client UA.
export function createS3Client(channel, options = {}) {
    const userAgent = normalizeS3UserAgent(channel.userAgent);
    const client = new S3Client({
        region: channel.region || 'auto',
        endpoint: channel.endpoint,
        credentials: {
            accessKeyId: channel.accessKeyId,
            secretAccessKey: channel.secretAccessKey,
        },
        forcePathStyle: channel.pathStyle || false,
        ...options,
    });

    if (userAgent) {
        // customUserAgent appends to the SDK UA; these providers require replacing it.
        client.middlewareStack.addRelativeTo((next) => async (args) => {
            args.request.headers['user-agent'] = userAgent;
            return next(args);
        }, {
            name: 'channelUserAgentMiddleware',
            relation: 'after',
            toMiddleware: 'getUserAgentMiddleware',
        });
    }
    return client;
}
