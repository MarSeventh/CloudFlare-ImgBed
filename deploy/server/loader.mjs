/**
 * 自定义 ESM Loader
 * 1. 自动为无扩展名的相对导入添加 .js 后缀
 * 2. 将 Cloudflare 特定的包重定向到本地 mock
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync } from 'fs';
import { dirname, resolve as pathResolve } from 'path';

// Mock 文件路径
const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKS = {
    '@cloudflare/pages-plugin-sentry': pathResolve(__dirname, 'mocks/sentry-plugin.js'),
    '@sentry/tracing': pathResolve(__dirname, 'mocks/sentry-tracing.js'),
};

export async function resolve(specifier, context, nextResolve) {
    // 拦截 Cloudflare 特定的包
    if (MOCKS[specifier]) {
        return {
            url: pathToFileURL(MOCKS[specifier]).href,
            shortCircuit: true,
        };
    }

    // 处理无扩展名的相对导入
    if (specifier.startsWith('.') && !hasExtension(specifier)) {
        const parentDir = context.parentURL
            ? dirname(fileURLToPath(context.parentURL))
            : process.cwd();

        // 尝试添加 .js 扩展名
        const withJs = pathResolve(parentDir, specifier + '.js');
        if (existsSync(withJs)) {
            return {
                url: pathToFileURL(withJs).href,
                shortCircuit: true,
            };
        }

        // 尝试作为目录的 index.js
        const indexJs = pathResolve(parentDir, specifier, 'index.js');
        if (existsSync(indexJs)) {
            return {
                url: pathToFileURL(indexJs).href,
                shortCircuit: true,
            };
        }
    }

    return nextResolve(specifier, context);
}

function hasExtension(specifier) {
    const lastSlash = specifier.lastIndexOf('/');
    const filename = lastSlash >= 0 ? specifier.slice(lastSlash + 1) : specifier;
    return filename.includes('.');
}
