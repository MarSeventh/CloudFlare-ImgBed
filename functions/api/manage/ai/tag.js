import { runManualBatch } from './_manualRunner.js';

export async function onRequestPost(context) {
    let body;
    try {
        body = await context.request.json();
    } catch {
        body = {};
    }
    return runManualBatch(context, body, {
        capability: 'tagging',
        hasResult: metadata => Array.isArray(metadata?.Tags) && metadata.Tags.length > 0
    });
}
