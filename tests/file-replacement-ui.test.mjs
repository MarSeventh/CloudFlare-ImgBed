import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const Vue = require('vue');
const { parse } = require('@vue/compiler-sfc');
const { compile } = require('@vue/compiler-dom');
const { renderToString } = require('@vue/server-renderer');
const code = readFileSync(new URL('../frontend/src/utils/replacementHelpers.js', import.meta.url), 'utf8');
const { replacementCompatible } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

function component(name, fetchWithAuth = async () => {}) {
    const { descriptor } = parse(readFileSync(new URL(`../frontend/src/components/dashboard/${name}.vue`, import.meta.url), 'utf8'));
    const script = descriptor.script.content.replace(/^import .+;$/gm, '').replace('export default', 'return');
    const options = new Function('fetchWithAuth', 'replacementCompatible', script)(fetchWithAuth, replacementCompatible);
    options.render = new Function('Vue', compile(descriptor.template.content, { mode: 'function', prefixIdentifiers: true }).code)(Vue);
    return options;
}

async function render(name, props) {
    const app = Vue.createSSRApp(component(name), props);
    app.config.globalProperties.$t = key => key;
    for (const name of ['ElTooltip', 'ElCheckbox', 'ElImage', 'ElCard', 'FontAwesomeIcon']) {
        app.component(name, { setup(props, { slots }) { return () => Vue.h('span', slots.default?.()); } });
    }
    return renderToString(app);
}

test('file list and card show replace, folder list never shows replace', async () => {
    const props = { item: { name: 'sample.png', metadata: { FileType: 'image/png' } }, visibleColumns: [], fileLink: '/file/sample.png' };
    assert.match(await render('FileCard', props), /aria-label="replaceFile.title"/);
    assert.match(await render('FileListItem', props), /aria-label="replaceFile.title"/);
    assert.doesNotMatch(await render('FileListItem', { ...props, item: { name: 'folder/', isFolder: true } }), /aria-label="replaceFile.title"/);
});

test('picker defaults to keeping source and sends one explicit target with deletion choice', async () => {
    const calls = []; const events = [];
    const options = component('ReplaceFileDialog', async (url, request) => {
        calls.push([url, request]); return Response.json({ success: true, sourceDeleted: false, warnings: [] });
    });
    const vm = { ...options.data(), ...options.methods,
        source: { name: 'folder/source.png', metadata: { FileType: 'image/png', ContentVersion: 'source-v' } },
        target: { name: 'archive/target.png', metadata: { FileType: 'image/png', ContentVersion: 'target-v' } },
        $emit: (...args) => events.push(args), $t: key => key };
    assert.equal(vm.deleteSource, false);
    await vm.submit();
    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0][1].body);
    assert.deepEqual(body, { target: 'archive/target.png', deleteSource: false,
        expectedSourcePath: 'folder/source.png', expectedTargetPath: 'archive/target.png', sourceVersion: 'source-v', targetVersion: 'target-v' });
    assert.equal(events[0][0], 'replaced'); assert.equal(vm.saving, false);
    vm.deleteSource = true; await vm.submit();
    assert.equal(JSON.parse(calls[1][1].body).deleteSource, true);
});

test('replacement errors keep the dialog open and repeated clicks while saving do not submit', async () => {
    const events = []; let count = 0;
    const options = component('ReplaceFileDialog', async () => { count++; return Response.json({ success: false, message: '文件内容已变化' }, { status: 409 }); });
    const vm = { ...options.data(), ...options.methods,
        source: { name: 'a.png', metadata: { FileType: 'image/png' } }, target: { name: 'b.png', metadata: { FileType: 'image/png' } },
        $emit: (...args) => events.push(args), $t: key => key };
    vm.saving = true; await vm.submit(); assert.equal(count, 0);
    vm.saving = false; await vm.submit(); assert.equal(count, 1);
    assert.equal(vm.error, '文件内容已变化'); assert.deepEqual(events, []);
});

test('original target card/list actions expose local picker, folders do not', async () => {
    const props = { item: { name: 'target.png', metadata: { FileType: 'image/png' } }, visibleColumns: [], fileLink: '/file/target.png' };
    assert.match(await render('FileCard', props), /aria-label="replaceFile.localTitle"/);
    assert.match(await render('FileListItem', props), /aria-label="replaceFile.localTitle"/);
    assert.doesNotMatch(await render('FileListItem', { ...props, item: { name: 'folder/', isFolder: true } }), /aria-label="replaceFile.localTitle"/);
    const mobile = component('MobileActionSheet');
    const events = [];
    mobile.methods.handleAction.call({ $emit: (...args) => events.push(args), close() {} }, 'replaceLocal');
    assert.deepEqual(events, [['action', 'replaceLocal']]);
    const dashboard = readFileSync(new URL('../frontend/src/views/AdminDashBoard.vue', import.meta.url), 'utf8');
    assert.equal((dashboard.match(/@replace-local="openLocalReplaceDialog\(item\)"/g) || []).length, 2);
    assert.match(dashboard, /case 'replaceLocal':[\s\S]*?this\.openLocalReplaceDialog\(file\)/);
    assert.match(dashboard, /<UploadReplacementDialog[^>]*@replaced="handleReplaced"/);
    assert.match(dashboard, /result\.warnings\?\.length[\s\S]*?\$message\.warning/);
});

function uploadVm(options) {
    const events = [];
    const vm = { ...options.data(), ...options.methods,
        target: { name: 'original/report.pdf', metadata: { FixedId: 'f_' + '1'.repeat(32), FileType: 'application/pdf', ContentVersion: 'original-v' } },
        $emit: (...args) => events.push(args), $t: key => key };
    vm.snapshot = { id: vm.target.metadata.FixedId, path: vm.target.name, contentVersion: vm.target.metadata.ContentVersion, type: vm.target.metadata.FileType };
    return { vm, events };
}

test('target action opens native picker; direct upload sends multipart with target identity and stale-write preconditions only', async () => {
    const calls = [];
    const options = component('UploadReplacementDialog', async (url, request) => {
        if (!request) return Response.json({ id: 'f_' + '1'.repeat(32), path: 'original/report.pdf', contentVersion: 'original-v', type: 'application/pdf' });
        calls.push([url, request]); return Response.json({ success: true, warnings: ['Old storage cleanup failed'] });
    });
    const { vm, events } = uploadVm(options);
    let clicked = 0;
    vm.$nextTick = callback => callback(); vm.$refs = { fileInput: { value: 'previous', click() { clicked++; } } };
    await options.watch.modelValue.call(vm, true);
    assert.equal(clicked, 1); assert.equal(vm.$refs.fileInput.value, ''); assert.equal(vm.file, null);
    vm.selectFile({ target: { files: [new File(['%PDF-new'], 'new.pdf', { type: 'application/pdf' })] } });
    await vm.submit();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '/api/manage/replace-file/' + vm.target.metadata.FixedId);
    assert.equal(calls[0][1].headers, undefined); // Browser supplies multipart boundary.
    const form = calls[0][1].body;
    assert.ok(form instanceof FormData); assert.equal(await form.get('file').text(), '%PDF-new');
    assert.equal(form.get('expectedPath'), 'original/report.pdf'); assert.equal(form.get('expectedVersion'), 'original-v');
    assert.deepEqual([...form.keys()], ['file', 'expectedPath', 'expectedVersion']);
    assert.deepEqual(events[0], ['replaced', { success: true, warnings: ['Old storage cleanup failed'] }]);
    assert.deepEqual(events[1], ['update:modelValue', false]); assert.equal(vm.saving, false);
});

test('local replacement errors remain visible, type errors do not submit, loading blocks duplicate clicks and dismissal', async () => {
    let calls = 0;
    const options = component('UploadReplacementDialog', async (url, request) => {
        if (!request) return Response.json({ id: 'f_' + '1'.repeat(32), path: 'moved/report.pdf', contentVersion: 'new-v', type: 'application/pdf' });
        calls++; return Response.json({ success: false, message: 'stale version' }, { status: 409 });
    });
    const { vm, events } = uploadVm(options);
    vm.file = new File(['png'], 'a.png', { type: 'image/png' }); await vm.submit();
    assert.equal(calls, 0); assert.equal(vm.error, 'replaceFile.localTypeError');
    vm.file = new File(['pdf'], 'a.pdf', { type: 'application/pdf' });
    vm.saving = true; await vm.submit(); vm.close(false); assert.deepEqual(events, []); assert.equal(calls, 0);
    vm.saving = false; await vm.submit(); assert.equal(calls, 1); assert.equal(vm.error, 'stale version；replaceFile.targetRefreshed');
    assert.equal(vm.snapshot.contentVersion, 'new-v');
    assert.deepEqual(events, []); assert.equal(vm.saving, false);
});

test('uncertain writes require picking again and preserve server warning details', async () => {
    const options = component('UploadReplacementDialog', async () => Response.json({ success: false, outcome: 'unknown', message: 'Refresh target first', warnings: ['staged content retained'] }, { status: 500 }));
    const { vm, events } = uploadVm(options);
    vm.file = new File(['pdf'], 'a.pdf', { type: 'application/pdf' }); await vm.submit();
    assert.equal(vm.file, null); assert.match(vm.error, /Refresh target first.*staged content retained/);
    assert.deepEqual(events, []); assert.equal(vm.saving, false);
});


test('legacy local action initializes identity and reads current path/version before submitting', async () => {
    const calls = [], id = 'f_' + '2'.repeat(32);
    const options = component('UploadReplacementDialog', async (url, request) => {
        calls.push([url, request]);
        if (url.includes('/identity/')) return Response.json({ fixedId: id });
        if (!request) return Response.json({ id, path: 'moved/report.pdf', contentVersion: 'live-v', type: 'application/pdf' });
        return Response.json({ success: true });
    });
    const { vm } = uploadVm(options);
    delete vm.target.metadata.FixedId;
    vm.$nextTick = callback => callback(); vm.$refs = {};
    await options.watch.modelValue.call(vm, true);
    assert.equal(calls[0][0], '/api/manage/identity/original%2Freport.pdf');
    assert.equal(calls[0][1].method, 'POST');
    assert.equal(calls[1][0], '/api/manage/replace-file/' + id);
    assert.equal(vm.error, 'replaceFile.targetRefreshed');
    vm.file = new File(['pdf'], 'a.pdf', { type: 'application/pdf' });
    await vm.submit();
    assert.equal(calls[2][0], '/api/manage/replace-file/' + id);
    assert.equal(calls[2][1].body.get('expectedPath'), 'moved/report.pdf');
    assert.equal(calls[2][1].body.get('expectedVersion'), 'live-v');
});

for (const failure of ['identity', 'preflight', 'missingId']) test(`local ${failure} failure blocks submission and keeps dialog open`, async () => {
    const calls = [];
    const options = component('UploadReplacementDialog', async (url, request) => {
        calls.push([url, request]);
        if (failure === 'missingId') return Response.json({});
        return Response.json({ message: 'Target unavailable' }, { status: 404 });
    });
    const { vm, events } = uploadVm(options);
    if (failure !== 'preflight') delete vm.target.metadata.FixedId;
    await vm.initialize();
    assert.equal(vm.snapshot, null); assert.ok(vm.error);
    vm.file = new File(['pdf'], 'a.pdf', { type: 'application/pdf' });
    await vm.submit();
    assert.equal(calls.length, 1); assert.deepEqual(events, []);
    assert.ok(calls.every(([url]) => !url.includes('undefined')));
});

test('409 refresh never retries automatically; second explicit confirmation sends refreshed preconditions', async () => {
    const calls = [], id = 'f_' + '1'.repeat(32);
    const options = component('UploadReplacementDialog', async (url, request) => {
        calls.push([url, request]);
        if (!request) return Response.json({ id, path: 'current/report.pdf', contentVersion: 'v2', type: 'application/pdf' });
        return request.body.get('expectedVersion') === 'v2' ? Response.json({ success: true }) :
            Response.json({ message: 'conflict' }, { status: 409 });
    });
    const { vm, events } = uploadVm(options);
    vm.file = new File(['pdf'], 'a.pdf', { type: 'application/pdf' });
    await vm.submit();
    assert.equal(calls.length, 2); assert.deepEqual(events, []);
    assert.equal(vm.error, 'conflict；replaceFile.targetRefreshed');
    await vm.submit();
    assert.equal(calls.length, 3);
    assert.equal(calls[2][1].body.get('expectedPath'), 'current/report.pdf');
    assert.equal(calls[2][1].body.get('expectedVersion'), 'v2');
    assert.equal(events[0][0], 'replaced');
});

test('409 refresh failure disables stale submission until a successful manual refresh', async () => {
    let calls = 0;
    const options = component('UploadReplacementDialog', async (url, request) => {
        calls++;
        return Response.json({ message: request ? 'conflict' : 'busy' }, { status: 409 });
    });
    const { vm, events } = uploadVm(options);
    vm.file = new File(['pdf'], 'a.pdf', { type: 'application/pdf' });
    await vm.submit(); await vm.submit();
    assert.equal(calls, 2); assert.equal(vm.snapshot, null); assert.equal(vm.error, 'busy'); assert.deepEqual(events, []);
});

test('late preflight from a closed dialog cannot overwrite a reopened target snapshot', async () => {
    let release;
    const options = component('UploadReplacementDialog', async () => new Promise(resolve => { release = resolve; }));
    const { vm } = uploadVm(options);
    const pending = vm.initialize();
    options.watch.modelValue.call(vm, false);
    vm.snapshot = { id: 'new target' };
    release(Response.json({ id: vm.target.metadata.FixedId, path: 'old.pdf', contentVersion: '', type: 'application/pdf' }));
    await pending;
    assert.deepEqual(vm.snapshot, { id: 'new target' });
});
