export async function onRequestPost(context) {
    // Contents of context object
    const {
      request, // same as existing Worker API
      env, // same as existing Worker API
      params, // if filename includes [id] or [[path]]
      waitUntil, // same as ctx.waitUntil in existing Worker API
      next, // used for middleware or to fetch assets
      data, // arbitrary space for passing data between middlewares
    } = context;
    //从POST请求中获取authCode
    const jsonRequest = await request.json();
    const authCode = jsonRequest.authCode;
    //验证authCode
    if (env.AUTH_CODE !== undefined && authCode !== env.AUTH_CODE) {
      return new Response('Unauthorized', { status: 401 })
    }
    //返回登录成功
    return new Response('Login success', { status: 200 })
}