import http from 'node:http';
import assert from 'node:assert/strict';
import { WebDAVAPI } from '../functions/utils/storage/webdavAPI.js';

/**
 * WebDAV 3xx 重定向回归测试。
 *
 * 服务端返回 3xx 是常见行为而非异常：反向代理的 http→https 跳转、
 * OpenList/AList 的 /dav 前缀与尾斜杠规范化、部分网盘驱动的预签名上传跳转。
 * 客户端必须在保留方法与请求体的前提下跟随，否则会出现
 * "远端已写入成功、数据库与索引均未更新" 的中间态。
 */

const servers = [];

function startServer(handler, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const srv = http.createServer(handler);
        srv.listen(0, host, () => {
            servers.push(srv);
            resolve({ port: srv.address().port, url: `http://${host}:${srv.address().port}/` });
        });
    });
}

function readBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

afterEach(() => {
    for (const srv of servers.splice(0)) srv.close();
});

describe('WebDAV 3xx redirect handling', () => {
    it('跟随 302 完成上传，并保留 PUT 方法与请求体、保留同主机认证', async () => {
        const seen = [];
        const { url } = await startServer(async (req, res) => {
            const pathname = new URL(req.url, 'http://x').pathname;
            const body = await readBody(req);
            seen.push({ method: req.method, pathname, length: body.length, auth: req.headers.authorization || null });

            // 模拟尾斜杠规范化：旧地址 302 到规范地址
            if (pathname === '/dav/sub/file.jpg') {
                res.writeHead(302, { Location: '/dav/real/sub/file.jpg' });
                return res.end();
            }
            res.writeHead(req.method === 'MKCOL' ? 201 : 201);
            res.end();
        });

        const api = new WebDAVAPI({ baseUrl: `${url}dav/`, username: 'u', password: 'p' });
        // 不应抛出 "WebDAV PUT failed: 302 Found"
        await api.putFile('sub/file.jpg', 'X'.repeat(4096), 'image/jpeg');

        const put = seen.find((s) => s.pathname === '/dav/real/sub/file.jpg' && s.method === 'PUT');
        assert.ok(put, '重定向后的 PUT 应到达规范地址');
        assert.equal(put.method, 'PUT', '301/302/307/308 不得把 PUT 降级为 GET');
        assert.equal(put.length, 4096, '请求体必须完整重放');
        assert.match(put.auth || '', /^Basic /, '同主机重定向应保留 Authorization');
        assert.ok(seen.some((s) => s.method === 'MKCOL'), 'ensureDirectory 的 MKCOL 也应跟随重定向');
    });

    it('跨主机重定向必须剥离认证信息', async () => {
        let leaked = 'not-called';
        const { url: targetUrl } = await startServer(async (req, res) => {
            leaked = req.headers.authorization || null;
            await readBody(req);
            res.writeHead(201);
            res.end();
        });
        const { url: sourceUrl } = await startServer((req, res) => {
            res.writeHead(302, { Location: `${targetUrl}upload` });
            res.end();
        });

        const api = new WebDAVAPI({ baseUrl: sourceUrl, username: 'u', password: 'p' });
        await api.putFile('a.txt', 'hello', 'text/plain');

        assert.equal(leaked, null, '重定向到其它主机时不得携带 Basic 凭据');
    });

    it('无限重定向不会挂起，按失败处理', async () => {
        let hits = 0;
        const { url } = await startServer((req, res) => {
            hits += 1;
            res.writeHead(302, { Location: '/loop' });
            res.end();
        });

        const api = new WebDAVAPI({ baseUrl: url, username: 'u', password: 'p' });
        await assert.rejects(() => api.putFile('loop.txt', 'x', 'text/plain'), /WebDAV PUT failed/);
        assert.ok(hits <= 12, `重定向跳数应有上限，实际请求 ${hits} 次`);
    });

    it('303 按规范降级为 GET', async () => {
        let finalMethod = null;
        const { url } = await startServer(async (req, res) => {
            if (req.url === '/start') {
                res.writeHead(303, { Location: '/done' });
                return res.end();
            }
            await readBody(req);
            finalMethod = req.method;
            res.writeHead(201);
            res.end();
        });

        const api = new WebDAVAPI({ baseUrl: url, username: 'u', password: 'p' });
        await api.putFile('start', 'abc', 'text/plain').catch(() => {});
        assert.equal(finalMethod, 'GET');
    });

    it('无 Location 的 302 抛出可诊断错误，不静默成功', async () => {
        const { url } = await startServer((req, res) => {
            res.writeHead(302);
            res.end();
        });

        const api = new WebDAVAPI({ baseUrl: url, username: 'u', password: 'p' });
        await assert.rejects(() => api.putFile('x.txt', 'x', 'text/plain'), /PUT failed: 302/);
    });
});
