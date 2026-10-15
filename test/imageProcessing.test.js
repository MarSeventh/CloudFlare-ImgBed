import assert from 'node:assert/strict';
import { parseImageTransform, validateImageTransformSource, transformImageResponse } from '../functions/file/imageTransform.js';

describe('image processing', () => {
    const request = { requested: true, options: { width: 100 } };

    it('retains request validation and backend-specific GIF/AVIF support', () => {
        const config = { imageTransformEnabled: true };
        assert.equal(parseImageTransform(new URL('https://test/file/a.jpg?width=0'), config).error, 'width must be a positive integer');
        assert.equal(validateImageTransformSource(request, {}, 'IMAGE/JPEG; charset=binary', 'a.bin'), null);
        for (const type of ['image/gif', 'image/avif', 'image/svg+xml', 'image/bmp', 'application/pdf']) {
            assert.equal(validateImageTransformSource(request, {}, type, 'a.jpg').response.status, 415);
        }
        assert.equal(validateImageTransformSource(request, { IMAGE_PROCESSOR: { transform() {} } }, 'image/gif', 'a.gif'), null);
        assert.equal(validateImageTransformSource(request, { IMAGES: { input() {} } }, 'image/avif', 'a.avif'), null);
        assert.equal(validateImageTransformSource(request, { IMAGES: { input() {} } }, 'image/gif', 'a.gif').response.status, 415);
    });

    it('does not reinterpret historical generic metadata or change original fallback behavior', () => {
        assert.equal(validateImageTransformSource(request, {}, 'application/octet-stream', 'a.jpg').response.status, 415);
        assert.deepEqual(validateImageTransformSource({ ...request, fallback: 'original' }, {}, 'image/svg+xml', 'a.svg'), { fallbackToOriginal: true });
        assert.equal(validateImageTransformSource(request, {}, '', 'README'), null);
        assert.equal(validateImageTransformSource(request, {}, '', 'a.unknown').response.status, 415);
    });

    it('passes a normalized source format to the processor and retains response headers', async () => {
        let options;
        const response = await transformImageResponse({
            imageTransform: request,
            env: { IMAGE_PROCESSOR: { async transform(stream, input) { options = input; return new Response('scaled', { headers: { 'Content-Type': 'image/png' } }); } } },
        }, new Response('source', { headers: { 'Content-Type': 'IMAGE/JPEG; charset=binary', 'ETag': 'old', 'Cache-Control': 'private' } }));
        assert.equal(options.sourceType, 'image/jpeg');
        assert.equal(options.outputFormat, 'image/jpeg');
        assert.equal(response.headers.get('Content-Type'), 'image/png');
        assert.equal(response.headers.has('ETag'), false);
        assert.equal(response.headers.get('Cache-Control'), 'private');
        assert.equal(await response.text(), 'scaled');
    });
});
