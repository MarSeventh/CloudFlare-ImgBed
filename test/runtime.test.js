import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';
import { loadFunction } from './helpers/loadFunction.js';

describe('deployment runtime', () => {
    for (const runtime of ['pages', 'worker', 'node']) {
        it(`sets ${runtime} from the entry context and exposes it to the frontend`, async () => {
            const userConfig = await loadFunction('functions/api/userConfig.js', {
                fetchPageConfig: async () => ({ config: [{ id: 'serverRuntime', value: 'incorrect' }] }),
                fetchUploadConfig: async () => ({}),
            });
            const context = {
                env: { SERVER_RUNTIME: 'node', img_d1: {} },
                data: runtime === 'pages' ? {} : { serverRuntime: runtime },
                next: () => userConfig.onRequest(context),
            };
            const response = await onRequest(context);
            assert.equal(context.env.SERVER_RUNTIME, runtime);
            assert.equal((await response.json()).serverRuntime, runtime);
        });
    }
});
