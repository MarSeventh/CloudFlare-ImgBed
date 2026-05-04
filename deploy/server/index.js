/**
 * Docker 模式下的原生 Node.js 服务器
 * 使用 Hono 作为 Web 框架，代理 Cloudflare Pages Functions 请求
 * 使用 SQLite 替代 D1，本地文件系统替代 R2
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getConnInfo } from '@hono/node-server/conninfo';
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { SqliteD1 } from './sqliteD1.js';
import { LocalR2Storage } from './r2Storage.js';

// ==================== 模拟 Cloudflare 全局 API ====================

// 模拟 Cloudflare Cache API（Node.js 中不存在）
if (typeof globalThis.caches === 'undefined') {
    globalThis.caches = {
        default: {
            async match() { return undefined; },
            async put() {},
            async delete() { return false; },
        },
    };
}

// ==================== 自引用 Fetch 拦截器 ====================
// 解决 Docker 端口映射导致 functions 内部 fetch(url.origin + ...) 失败的问题
// 不再重写请求 URL，而是拦截自引用的 fetch 调用，透明路由到内部端口
// 这样 url.origin 保持为外部 origin，确保 Referer 匹配、返回链接、重定向等功能正常

const selfOrigins = new Set();
const originalFetch = globalThis.fetch;

globalThis.fetch = async function(input, init) {
    try {
        let urlStr;
        if (typeof input === 'string') {
            urlStr = input;
        } else if (input instanceof URL) {
            urlStr = input.toString();
        } else if (input instanceof Request) {
            urlStr = input.url;
        }

        if (urlStr) {
            const parsed = new URL(urlStr);
            const internalOrigin = `http://localhost:${port}`;
            // 如果目标 origin 是已知的外部自身 origin，重写为内部地址
            if (parsed.origin !== internalOrigin && selfOrigins.has(parsed.origin)) {
                const newUrl = `${internalOrigin}${parsed.pathname}${parsed.search}`;
                if (input instanceof Request) {
                    return originalFetch(new Request(newUrl, input), init);
                }
                return originalFetch(newUrl, init);
            }
        }
    } catch (e) {
        // URL 解析失败等异常，回退到原始 fetch
        if (!(e instanceof TypeError)) {
            console.error('Fetch interceptor error:', e.message);
        }
    }
    return originalFetch(input, init);
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../..');
const FUNCTIONS_DIR = resolve(ROOT_DIR, 'functions');
const DATA_DIR = resolve(ROOT_DIR, 'data');
const port = parseInt(process.env.PORT || '8080', 10);

// 确保数据目录存在
mkdirSync(DATA_DIR, { recursive: true });

// ==================== 初始化数据库 ====================

const sqliteD1 = new SqliteD1(join(DATA_DIR, 'database.sqlite'));

// 执行初始化 SQL
const initSqlPath = join(ROOT_DIR, 'database', 'init.sql');
if (existsSync(initSqlPath)) {
    const initSql = readFileSync(initSqlPath, 'utf8');
    try {
        sqliteD1.exec(initSql);
        console.log('Database initialized successfully');
    } catch (e) {
        console.log('Database init:', e.message);
    }
}

// 执行数据库迁移
const migrationsDir = join(ROOT_DIR, 'database', 'migrations');
if (existsSync(migrationsDir)) {
    const migrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const migration of migrations) {
        try {
            const sql = readFileSync(join(migrationsDir, migration), 'utf8');
            sqliteD1.exec(sql);
            console.log(`Migration ${migration}: OK`);
        } catch (e) {
            // 忽略已执行的迁移（如列已存在等）
            console.log(`Migration ${migration}: ${e.message}`);
        }
    }
}

// ==================== 初始化 R2 存储 ====================

const r2Storage = new LocalR2Storage(join(DATA_DIR, 'r2'));

// ==================== 创建环境对象 ====================

function createEnv() {
    return {
        ...process.env,
        img_d1: sqliteD1,
        img_r2: r2Storage,
    };
}

// ==================== Functions 路由解析 ====================

/**
 * 根据请求路径查找对应的 function 文件
 */
function findFunctionFile(pathname) {
    const parts = pathname.split('/').filter(Boolean);

    // 1. 尝试精确匹配
    if (parts.length > 0) {
        const exactFile = join(FUNCTIONS_DIR, ...parts) + '.js';
        if (existsSync(exactFile) && statSync(exactFile).isFile()) {
            return { file: exactFile, params: {} };
        }
    }

    // 2. 尝试 index.js 匹配
    if (parts.length > 0) {
        const indexFile = join(FUNCTIONS_DIR, ...parts, 'index.js');
        if (existsSync(indexFile) && statSync(indexFile).isFile()) {
            return { file: indexFile, params: {} };
        }
    }

    // 3. 尝试 [[path]].js 通配符匹配（从深到浅）
    for (let i = parts.length; i >= 0; i--) {
        const dirParts = parts.slice(0, i);
        const dirPath = join(FUNCTIONS_DIR, ...dirParts);
        if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
            const catchAllFile = join(dirPath, '[[path]].js');
            if (existsSync(catchAllFile) && statSync(catchAllFile).isFile()) {
                const pathParam = parts.slice(i);
                return { file: catchAllFile, params: { path: pathParam } };
            }
        }
    }

    return null;
}

/**
 * 查找请求路径对应的中间件链
 */
const middlewareCache = new Map();

async function findMiddlewares(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const allMiddlewares = [];

    // 检查根 functions 目录
    const rootMiddleware = join(FUNCTIONS_DIR, '_middleware.js');
    if (existsSync(rootMiddleware)) {
        const mod = await importModule(rootMiddleware);
        if (mod.onRequest) {
            const handlers = Array.isArray(mod.onRequest) ? mod.onRequest : [mod.onRequest];
            allMiddlewares.push(...handlers);
        }
    }

    // 逐级检查子目录中间件
    for (let i = 1; i <= parts.length; i++) {
        const dirParts = parts.slice(0, i);
        const middlewareFile = join(FUNCTIONS_DIR, ...dirParts, '_middleware.js');
        if (existsSync(middlewareFile) && statSync(middlewareFile).isFile()) {
            const mod = await importModule(middlewareFile);
            if (mod.onRequest) {
                const handlers = Array.isArray(mod.onRequest) ? mod.onRequest : [mod.onRequest];
                allMiddlewares.push(...handlers);
            }
        }
    }

    return allMiddlewares;
}

/**
 * 模块导入缓存
 */
const moduleCache = new Map();

async function importModule(filePath) {
    if (moduleCache.has(filePath)) {
        return moduleCache.get(filePath);
    }
    // Windows 上 ESM 动态 import 必须使用 file:// URL，不能直接用磁盘路径
    const mod = await import(pathToFileURL(filePath).href);
    moduleCache.set(filePath, mod);
    return mod;
}


/**
 * 执行中间件链和处理函数
 */
async function executeChain(middlewares, handler, context) {
    const chain = [...middlewares, handler];
    let index = 0;

    context.next = async function () {
        if (index < chain.length) {
            const fn = chain[index++];
            return await fn(context);
        }
        // 如果链执行完毕，返回 404
        return new Response('Not Found', { status: 404 });
    };

    return await context.next();
}

/**
 * 处理 Functions 请求
 */
async function handleFunctionRequest(originalRequest, pathname) {
    // 查找对应的 function 文件
    const funcInfo = findFunctionFile(pathname);
    if (!funcInfo) return null;

    // 记录外部 origin，供 fetch 拦截器使用
    // 不再重写请求 URL，保持 url.origin 为外部 origin
    const request = originalRequest;
    const requestUrl = new URL(originalRequest.url);
    const internalOrigin = `http://localhost:${port}`;
    if (requestUrl.origin !== internalOrigin) {
        selfOrigins.add(requestUrl.origin);
    }

    // 导入模块
    const mod = await importModule(funcInfo.file);

    // 根据请求方法查找处理函数
    const method = request.method.toUpperCase();
    const methodHandlerName = 'onRequest' + method.charAt(0) + method.slice(1).toLowerCase();

    let handler = null;
    if (typeof mod[methodHandlerName] === 'function') {
        handler = mod[methodHandlerName];
    } else if (mod.onRequest) {
        handler = typeof mod.onRequest === 'function'
            ? mod.onRequest
            : mod.onRequest[mod.onRequest.length - 1];
    }

    if (!handler) {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // 获取中间件
    const middlewares = await findMiddlewares(pathname);

    // 如果 onRequest 是数组，把前面的加入中间件链
    if (Array.isArray(mod.onRequest) && mod.onRequest.length > 1 && handler === mod.onRequest[mod.onRequest.length - 1]) {
        middlewares.push(...mod.onRequest.slice(0, -1));
    }

    // 模拟 Cloudflare 的 request.cf 属性（telemetryData 等中间件依赖该属性）
    if (!request.cf) {
        request.cf = {
            country: 'XX',
            city: 'Unknown',
            continent: 'XX',
            latitude: '0',
            longitude: '0',
            region: '',
            regionCode: '',
            timezone: '',
            postalCode: '',
            asn: 0,
            asOrganization: '',
            colo: 'LOCAL',
            httpProtocol: 'HTTP/1.1',
            requestPriority: '',
            tlsCipher: '',
            tlsVersion: '',
        };
    }

    // 创建 Cloudflare Pages Functions 风格的 context 对象
    const env = createEnv();
    const context = {
        request,
        env,
        params: funcInfo.params,
        waitUntil: (promise) => {
            if (promise && typeof promise.catch === 'function') {
                promise.catch(err => console.error('waitUntil error:', err));
            }
        },
        next: null, // 由 executeChain 设置
        data: {},
    };

    // 执行中间件链和处理函数
    return await executeChain(middlewares, handler, context);
}

// ==================== Hono 应用 ====================

const app = new Hono();

// 判断是否是 function 路径
const FUNCTION_PREFIXES = ['/api/', '/upload', '/file/', '/dav/', '/random'];

function isFunctionPath(pathname) {
    return FUNCTION_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

// Functions 路由处理 - 处理所有 HTTP 方法
app.all('*', async (c, next) => {
    const url = new URL(c.req.url);
    const pathname = url.pathname;

    // 检查是否是 function 路径
    if (isFunctionPath(pathname)) {
        try {
            // 获取客户端真实 IP 并注入到请求 header 中
            // 因为 Node.js 环境没有 cf-connecting-ip 等 CDN header
            let request = c.req.raw;
            try {
                const info = getConnInfo(c);
                let clientIp = info.remote?.address;
                // 去掉 IPv6-mapped IPv4 前缀，如 ::ffff:127.0.0.1 → 127.0.0.1
                if (clientIp && clientIp.startsWith('::ffff:')) {
                    clientIp = clientIp.slice(7);
                }
                if (clientIp && !request.headers.get('x-real-ip')) {
                    const newHeaders = new Headers(request.headers);
                    newHeaders.set('x-real-ip', clientIp);
                    request = new Request(request.url, {
                        method: request.method,
                        headers: newHeaders,
                        body: request.body,
                        duplex: 'half',
                    });
                }
            } catch (e) {
                // 获取 IP 失败不影响请求处理
            }
            const response = await handleFunctionRequest(request, pathname);
            if (response) {
                return response;
            }
        } catch (err) {
            console.error('Function error:', err);
            return new Response(`Internal Server Error: ${err.message}`, { status: 500 });
        }
    }

    // 不是 function 路径，继续到静态文件
    await next();
});

// 静态文件服务
app.use('/*', serveStatic({
    root: './frontend-dist',
    rewriteRequestPath: (path) => path,
}));

// 默认返回 index.html（SPA 支持）
app.get('*', async (c) => {
    const indexPath = join(ROOT_DIR, 'frontend-dist', 'index.html');
    if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf8');
        return c.html(content);
    }
    return c.text('Not Found', 404);
});

// ==================== 启动服务器 ====================

serve({
    fetch: app.fetch,
    port,
}, (info) => {
    console.log(`Server running at http://0.0.0.0:${info.port}`);
    console.log(`Data directory: ${DATA_DIR}`);
    console.log(`Mode: Docker (Native Node.js)`);
});
