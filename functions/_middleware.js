// functions/_middleware.js

// 预检请求的处理 (这部分完全不变)
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, POST, PUT, DELETE',
      'Access-Control-Max-Age': '86400',
    },
  });
};

// 实际请求的处理 (只在这里面增加一行)
export const onRequest = async (context) => {
  // 执行后续的逻辑，获取原始响应
  const response = await context.next();

  // 在响应上添加CORS头 (保留原有逻辑)
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Max-Age', '86400');

  // --- 新增代码在这里 ---
  // 设置缓存控制，这里设置为 1 小时 (3600秒)
  // 你可以按需修改这个数字，比如 300 (5分钟) 或 86400 (1天)
  response.headers.set('Cache-Control', 'public, max-age=3600');
  // --- 新增代码结束 ---

  return response;
};

