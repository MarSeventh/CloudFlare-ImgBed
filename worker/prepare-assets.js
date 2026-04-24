/**
 * Worker 部署前的静态资源收集脚本
 * 将前端构建产物复制到 .worker-assets/ 目录
 * 避免 wrangler 扫描 node_modules 等无关文件
 */

import { cpSync, rmSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, '.worker-assets');

// 需要收集的前端资源（目录和文件）
const assets = [
    'css',
    'js',
    'fonts',
    'img',
    'static',
    'index.html',
    'logo.png',
    'logo-dark.png',
];

// 清理并重建输出目录
if (existsSync(OUT)) {
    rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

let count = 0;
for (const name of assets) {
    const src = resolve(ROOT, name);
    if (!existsSync(src)) {
        console.log(`  skip: ${name} (not found)`);
        continue;
    }
    const dest = resolve(OUT, name);
    cpSync(src, dest, { recursive: true });
    count++;
    console.log(`  copy: ${name}`);
}

console.log(`\nCollected ${count} asset(s) into .worker-assets/`);
