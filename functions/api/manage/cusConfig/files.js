import { readIndex } from "../../../utils/indexManager";

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const ip = url.searchParams.get('ip');
    let start = parseInt(url.searchParams.get('start'), 10) || 0;
    let count = parseInt(url.searchParams.get('count'), 10) || 20;

    if (!ip) {
        return new Response(JSON.stringify({ error: 'Missing ip parameter' }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    start = Math.max(0, start);
    count = Math.max(1, count);

    const allRecords = await readIndex(context, { count: -1, includeSubdirFiles: true });
    const files = allRecords.files.filter(item => item.metadata?.UploadIP === ip);

    return new Response(JSON.stringify({
        data: files.slice(start, start + count),
        total: files.length,
    }), {
        headers: { "Content-Type": "application/json" }
    });
}
