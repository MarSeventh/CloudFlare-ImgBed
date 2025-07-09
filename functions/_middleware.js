// functions/_middleware.js

// 预检请求的处理
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

// 实际请求的处理
export const onRequest = async (context) => {
  // 执行后续的逻辑，获取原始响应
  const response = await context.next();

  // 在响应上添加CORS头
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
};
