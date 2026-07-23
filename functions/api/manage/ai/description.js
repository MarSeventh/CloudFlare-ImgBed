import { runManualBatch } from './_manualRunner.js';

export async function onRequestPost(context) {
    let body;
    try {
        body = await context.request.json();
    } catch {
        body = {};
    }
    return runManualBatch(context, body, {
        capability: 'description',
        hasResult: metadata => typeof metadata?.Description === 'string' && metadata.Description.length > 0
    });
}
