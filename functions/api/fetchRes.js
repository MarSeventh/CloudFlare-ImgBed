export async function onRequest(context) {
    // 获取请求体中URL的内容
    const {
        request,
        env,
        params,
        waitUntil,
        next,
        data
    } = context;
    const jsonRequest = await request.json();
    const url = jsonRequest.url;
    if (url === undefined) {
        return new Response('URL is required', { status: 400 })
    }
    const response = await fetch(url);
    const headers = new Headers(response.headers);
    return new Response(response.body, {
        headers: headers
    })
}