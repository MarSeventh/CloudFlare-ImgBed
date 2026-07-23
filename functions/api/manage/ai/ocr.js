import { runManualBatch } from './_manualRunner.js';

export async function onRequestPost(context) {
    let body;
    try {
        body = await context.request.json();
    } catch {
        body = {};
    }
    return runManualBatch(context, body, {
        capability: 'ocr',
        hasResult: metadata => typeof metadata?.OCR === 'string' && metadata.OCR.length > 0
    });
}
