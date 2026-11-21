import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run the real server in an isolated checkout so no user database or R2 files are touched.
const root = fileURLToPath(new URL('../..', import.meta.url));
const temporaryRoot = resolve(tmpdir());
const fixture = await mkdtemp(join(temporaryRoot, 'imgbed-header-test-'));
let server;
let closed;
let output = '';
try {
    for (const directory of ['deploy/server', 'functions', 'database']) {
        await cp(join(root, directory), join(fixture, directory), { recursive: true });
    }
    await writeFile(join(fixture, 'package.json'), '{"type":"module"}');
    await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await mkdir(join(fixture, 'frontend-dist'));
    await writeFile(join(fixture, 'frontend-dist/index.html'), '<!doctype html><title>Header test</title>');
    await writeFile(join(fixture, 'frontend-dist/style.css'), 'body { color: red; }');

    server = spawn(process.execPath, ['--import', './deploy/server/register.mjs', 'deploy/server/index.js'], {
        cwd: fixture,
        env: { ...process.env, PORT: '0', EXPIRY_CLEANUP_INTERVAL_MINUTES: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    closed = new Promise(resolveExit => server.once('close', resolveExit));
    const origin = await new Promise((resolveReady, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Server startup timed out:\n${output}`)), 15000);
        const finish = (error, address) => {
            clearTimeout(timeout);
            if (error) reject(error);
            else resolveReady(address);
        };
        server.once('error', error => finish(error));
        server.once('exit', code => finish(new Error(`Server exited (${code}):\n${output}`)));
        server.stderr.on('data', chunk => { output += chunk; });
        server.stdout.on('data', chunk => {
            output += chunk;
            const match = output.match(/Server running at http:\/\/0\.0\.0\.0:(\d+)/);
            if (match) finish(null, `http://127.0.0.1:${match[1]}`);
        });
    });

    const cases = [
        ['/', {}, 200],
        ['/dashboard', {}, 200],
        ['/style.css', {}, 200],
        ['/style.css', { method: 'HEAD' }, 200],
        ['/api/userConfig', {}, 200],
        ['/api/auth/adminLogin', {}, 405],
        ['/api/auth/adminLogin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }, 500],
        ['/missing', { method: 'POST' }, 404],
    ];
    for (const [path, init, status] of cases) {
        const response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
        const body = await response.text();
        assert.equal(response.status, status, `${init.method || 'GET'} ${path}: ${body}`);
        assert.equal(response.headers.get('X-Project'), 'CloudFlare-ImgBed', path);
        assert.equal(response.headers.get('X-Powered-By'), 'SanyueQi', path);
        if (init.method === 'HEAD') assert.equal(body, '');
        if (path === '/style.css' && !init.method) assert.equal(body, 'body { color: red; }');
        if (path === '/api/userConfig') assert.equal(JSON.parse(body).serverRuntime, 'node');
    }
    console.log('Server headers passed: HTML, SPA fallback, static GET/HEAD, API and 404/405/500 responses');
} finally {
    if (server) {
        if (server.exitCode === null) server.kill();
        await closed;
    }
    // Delete only the unique temporary fixture, never the checkout or a user's data directory.
    assert.equal(dirname(resolve(fixture)), temporaryRoot);
    assert.ok(basename(fixture).startsWith('imgbed-header-test-'));
    await rm(fixture, { recursive: true, force: true, maxRetries: 3 });
}
