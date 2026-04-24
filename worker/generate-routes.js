/**
 * 自动扫描 functions/ 目录，生成 worker/index.js
 * 
 * 扫描规则（与 Cloudflare Pages Functions 一致）：
 * - _middleware.js  → 中间件，按目录层级链式执行
 * - index.js        → 映射到所在目录路径
 * - [[path]].js     → catch-all 路由
 * - xxx.js          → 精确路由
 * - utils/ 目录跳过（工具模块，不是路由）
 * - 不含 onRequest 导出的文件跳过（工具模块）
 * 
 * 使用方式: node worker/generate-routes.js
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FUNCTIONS_DIR = join(ROOT, 'functions');

// 跳过的目录名（工具模块，不参与路由）
const SKIP_DIRS = new Set(['utils']);

// ==================== 扫描 functions 目录 ====================

const middlewares = [];  // { dirPath, importPath, varName }
const routes = [];       // { urlPath, importPath, varName, isCatchAll, dir, middlewareVarNames }

/**
 * 检查文件是否包含 onRequest 导出（Pages Functions 路由的标志）
 */
function hasOnRequestExport(filePath) {
    const content = readFileSync(filePath, 'utf8');
    return /export\s+(async\s+)?function\s+onRequest/m.test(content)
        || /export\s+const\s+onRequest\b/m.test(content);
}

/**
 * 将文件路径转为合法的 JS 变量名
 */
function toVarName(filePath) {
    const rel = relative(FUNCTIONS_DIR, filePath)
        .replace(/\\/g, '/')
        .replace(/\.js$/, '')
        .replace(/\[\[path\]\]/g, 'catchAll')
        .replace(/\/index$/, '_index');
    
    // 转为 camelCase
    return rel
        .split(/[\/\-.]/)
        .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

/**
 * 将 functions/ 下的文件路径转为 URL 路径
 */
function toUrlPath(filePath) {
    let rel = relative(FUNCTIONS_DIR, filePath)
        .replace(/\\/g, '/')
        .replace(/\.js$/, '');
    
    if (rel.endsWith('/index')) {
        rel = rel.slice(0, -'/index'.length);
    }
    
    const isCatchAll = rel.endsWith('/[[path]]');
    if (isCatchAll) {
        rel = rel.slice(0, -'[[path]]'.length); // 保留尾部斜杠
    }
    
    return { urlPath: '/' + rel, isCatchAll };
}

/**
 * 获取文件相对于 worker/ 目录的导入路径
 */
function toImportPath(filePath) {
    let rel = relative(__dirname, filePath).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
}

/**
 * 收集某个目录路径上所有层级的中间件变量名（从根到当前目录）
 */
function getMiddlewareChain(dirPath) {
    const chain = [];
    const parts = dirPath ? dirPath.split('/') : [];
    
    let currentDir = '';
    
    // 检查 functions/ 根目录
    const rootMw = middlewares.find(m => m.dirPath === '');
    if (rootMw) chain.push(rootMw.varName);
    
    // 逐级检查子目录
    for (const part of parts) {
        currentDir = currentDir ? currentDir + '/' + part : part;
        const mw = middlewares.find(m => m.dirPath === currentDir);
        if (mw) chain.push(mw.varName);
    }
    
    return chain;
}

/**
 * 递归扫描目录
 */
function scanDir(dir) {
    const entries = readdirSync(dir).sort();
    
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (SKIP_DIRS.has(basename(fullPath))) continue;
            scanDir(fullPath);
            continue;
        }
        
        if (!entry.endsWith('.js')) continue;
        
        // 中间件
        if (entry === '_middleware.js') {
            const dirPath = relative(FUNCTIONS_DIR, dir).replace(/\\/g, '/');
            const varName = 'mw_' + (dirPath.replace(/[\/\-.]/g, '_') || 'root');
            middlewares.push({
                dirPath,
                importPath: toImportPath(fullPath),
                varName,
            });
            continue;
        }
        
        // 检查是否为路由文件（必须导出 onRequest）
        if (!hasOnRequestExport(fullPath)) {
            continue;
        }
        
        const varName = toVarName(fullPath);
        const importPath = toImportPath(fullPath);
        const { urlPath, isCatchAll } = toUrlPath(fullPath);
        
        routes.push({
            urlPath,
            importPath,
            varName,
            isCatchAll,
            dir: relative(FUNCTIONS_DIR, dir).replace(/\\/g, '/'),
        });
    }
}

// 执行扫描
scanDir(FUNCTIONS_DIR);

// ==================== 生成代码 ====================

// 为每个路由计算中间件链
for (const route of routes) {
    route.middlewareVarNames = getMiddlewareChain(route.dir);
}

// 排序：精确路由在前，catch-all 在后；同类中按路径深度降序（深的优先匹配）
routes.sort((a, b) => {
    if (a.isCatchAll !== b.isCatchAll) return a.isCatchAll ? 1 : -1;
    const depthA = a.urlPath.split('/').length;
    const depthB = b.urlPath.split('/').length;
    if (depthA !== depthB) return depthB - depthA;
    return a.urlPath.localeCompare(b.urlPath);
});

// 生成 import 语句
let imports = '// --- 中间件（自动生成） ---\n';
for (const mw of middlewares) {
    imports += `import * as ${mw.varName} from '${mw.importPath}';\n`;
}
imports += '\n// --- 路由模块（自动生成） ---\n';
for (const route of routes) {
    imports += `import * as ${route.varName} from '${route.importPath}';\n`;
}

// 生成路由表
let routeEntries = '';
for (const route of routes) {
    const mwArray = route.middlewareVarNames.length > 0
        ? `[${route.middlewareVarNames.join(', ')}]`
        : '[]';
    
    if (route.isCatchAll) {
        routeEntries += `    { path: '${route.urlPath}', module: ${route.varName}, middlewares: ${mwArray}, catchAll: true },\n`;
    } else {
        routeEntries += `    { path: '${route.urlPath}', module: ${route.varName}, middlewares: ${mwArray} },\n`;
    }
}

// 组装完整文件
const output = `/**
 * Cloudflare Workers 部署适配层（自动生成，请勿手动编辑）
 * 生成命令: node worker/generate-routes.js
 * 
 * 复用 functions/ 下的全部业务逻辑，不修改任何业务代码
 */

// ==================== 自动生成的导入 ====================

${imports}

// ==================== 自动生成的路由表 ====================

const routes = [
${routeEntries}];


// ==================== 路由匹配 ====================

function matchRoute(pathname) {
    for (const route of routes) {
        if (route.catchAll) {
            if (pathname.startsWith(route.path)) {
                const rest = pathname.slice(route.path.length);
                const pathParam = rest.split('/').filter(Boolean);
                return { route, params: { path: pathParam } };
            }
        } else {
            if (pathname === route.path || pathname === route.path + '/') {
                return { route, params: {} };
            }
        }
    }
    return null;
}


// ==================== 中间件链执行 ====================

function collectMiddlewares(middlewareModules) {
    const handlers = [];
    for (const mod of middlewareModules) {
        if (mod.onRequest) {
            if (Array.isArray(mod.onRequest)) {
                handlers.push(...mod.onRequest);
            } else {
                handlers.push(mod.onRequest);
            }
        }
    }
    return handlers;
}

async function executeChain(middlewares, handler, context) {
    const chain = [...middlewares, handler];
    let index = 0;
    context.next = async function () {
        if (index < chain.length) {
            return await chain[index++](context);
        }
        return new Response('Not Found', { status: 404 });
    };
    return await context.next();
}


// ==================== Worker 入口 ====================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        const matched = matchRoute(pathname);

        if (!matched) {
            if (env.ASSETS) {
                return env.ASSETS.fetch(request);
            }
            return new Response('Not Found', { status: 404 });
        }

        const { route, params } = matched;
        const mod = route.module;

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

        const middlewares = collectMiddlewares(route.middlewares);

        if (Array.isArray(mod.onRequest) && mod.onRequest.length > 1 &&
            handler === mod.onRequest[mod.onRequest.length - 1]) {
            middlewares.push(...mod.onRequest.slice(0, -1));
        }

        const context = {
            request,
            env,
            params,
            waitUntil: ctx.waitUntil.bind(ctx),
            next: null,
            data: {},
        };

        return await executeChain(middlewares, handler, context);
    },
};
`;

// 写入文件
const outputPath = join(__dirname, 'index.js');
writeFileSync(outputPath, output, 'utf8');

console.log(`Generated worker/index.js`);
console.log(`  Middlewares: ${middlewares.length}`);
console.log(`  Routes: ${routes.length} (${routes.filter(r => r.isCatchAll).length} catch-all)`);
