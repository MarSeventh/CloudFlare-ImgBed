// 重建响应以兼容 fetch/Cache API 的只读标头，直接复用流，不读取文件内容。
// Node 入口传入原生 Response，保留其响应归一化行为。
export function withProjectHeaders(response, ResponseConstructor = Response) {
    const result = new ResponseConstructor(response.body, response);
    result.headers.set('X-Project', 'CloudFlare-ImgBed');
    result.headers.set('X-Powered-By', 'SanyueQi');
    return result;
}
