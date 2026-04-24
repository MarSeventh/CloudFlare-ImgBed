/**
 * Worker 部署前的静态资源收集脚本
 * 将 frontend-dist/ 目录复制到 .worker-assets/
 * 避免 wrangler 扫描 node_modules 等无关文件
 */

import { cpSync, rmSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'frontend-dist');
const OUT = resolve(ROOT, '.worker-assets');

if (!existsSync(SRC)) {
    console.error('Error: frontend-dist/ directory not found');
    process.exit(1);
}

// 清理并复制
if (existsSync(OUT)) {
    rmSync(OUT, { recursive: true, force: true });
}

cpSync(SRC, OUT, { recursive: true });
console.log('Copied frontend-dist/ → .worker-assets/');
