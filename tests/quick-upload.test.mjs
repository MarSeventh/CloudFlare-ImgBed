import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setImmediate as tick } from 'node:timers/promises';
import { quickUploadSettings } from '../frontend/src/utils/upload/quickUploadSettings.js';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { parse } = require('@vue/compiler-sfc');
function component(file, bindings) {
    const { descriptor } = parse(readFileSync(new URL(`../frontend/src/${file}`, import.meta.url), 'utf8'));
    const code = descriptor.script.content.replace(/^import .+$/gm, '').replace('export default', 'return');
    return new Function(...Object.keys(bindings), code)(...Object.values(bindings));
}
function uploadVM(axios) {
    const options = component('components/upload/UploadForm.vue', { axios, mapGetters: () => ({}), UploadFileItem: {}, buildFileUrls: (src, name, root) => ({ finalURL: root + src }), updateFileListUrls: () => {}, getUrlByFormat: () => {}, computeSha256: async () => 'hash', imageConversion: {} });
    const events = [];
    const vm = { ...options.data(), ...options.methods, compact: true, uploadFolder: '资料/原目录', channelName: 'saved-channel', uploadChannel: 'telegram', customerCompress: false, serverCompress: false, convertToWebp: false, autoRetry: false, autoReUpload: false, uploadNameType: 'default', compressBar: 5, rootUrl: 'https://example.test/file/', $emit: (...args) => events.push(args), $t: key => key, $message: Object.assign(() => {}, {error() {}}), saveToHistory() {} };
    return { vm, options, events };
}

test('quick upload inherits saved settings, respects explicit false and empty channel selection', () => {
    const getters = { userConfig: { defaultUploadChannel: 's3', defaultChannelName: 'default', defaultCustomerCompress: 'false', defaultCompressQuality: '8' }, storeChannelName: '', compressConfig: { serverCompress: false } };
    const settings = quickUploadSettings(getters, { s3: [{name:'default'}] });
    assert.equal(settings.uploadChannel, 's3'); assert.equal(settings.channelName, '');
    assert.equal(settings.customerCompress, false); assert.equal(settings.serverCompress, false); assert.equal(settings.compressQuality, 8);
    getters.storeChannelName = null; assert.equal(quickUploadSettings(getters, {s3:[{name:'default'}]}).channelName, 'default');
    getters.storeChannelName = 'removed'; assert.equal(quickUploadSettings(getters, {s3:[{name:'default'}]}).channelName, '');
});

test('picker captures the current folder instead of the upload-page folder', () => {
    const options = component('components/dashboard/QuickUpload.vue', { UploadForm: {}, axios: {}, quickUploadSettings });
    const vm = {currentPath:'当前/目录', uploadFolder:'old', $store:{getters:{storeUploadFolder:'别的目录'}}};
    options.methods.captureDestination.call(vm);
    assert.equal(vm.uploadFolder, '当前/目录'); vm.currentPath = 'another'; assert.equal(vm.uploadFolder, '当前/目录');
    vm.currentPath = ''; options.methods.captureDestination.call(vm); assert.equal(vm.uploadFolder, '');
});

test('upload and retry preserve the selected directory and channel after navigation, and success refreshes the dashboard', async () => {
    const requests = [];
    const {vm, events} = uploadVM(async options => { requests.push(options); return {data:[{src:'/file/f_test'}]}; });
    const file = new File(['test-content'], 'report.pdf', {type:'application/pdf'}); file.uid = 1;
    await vm.beforeUpload(file);
    assert.equal(vm.preparingUploads, 0);
    vm.uploadFolder = '切换后的目录'; vm.channelName = 'different-channel';
    const oldWindow = globalThis.window; globalThis.window = {location:{protocol:'https:',host:'example.test'}};
    try {
        const request = {file, onSuccess: (response, file) => vm.handleSuccess(response, file), onError:(error,file)=>vm.handleError(error,file), onProgress:event=>vm.handleProgress(event)};
        vm.uploadFile(request); await tick();
        assert.equal(requests.length, 1);
        const url = new URL(requests[0].url, 'https://example.test');
        assert.equal(url.pathname, '/upload'); assert.equal(url.searchParams.get('uploadFolder'), '资料/原目录');
        assert.equal(url.searchParams.get('channelName'), 'saved-channel');
        assert.equal(requests[0].data.get('file').name, 'report.pdf'); assert.equal(requests[0].withAuthCode, true);
        assert.equal(events[0][0], 'uploaded'); assert.equal(vm.fileList[0].status, 'success');
        assert.equal(vm.activeUploads, 0);
        vm.uploadFile(request); await tick(); assert.equal(requests[1].url, requests[0].url);
    } finally { globalThis.window = oldWindow; URL.revokeObjectURL(vm.fileList[0].url); }
});

test('failed uploads report failure, release busy state and do not report success', async () => {
    const {vm, events, options} = uploadVM(async () => { throw {response:{status:401}}; });
    const file = new File(['test'], 'private.pdf', {type:'application/pdf'}); file.uid = 2;
    await vm.beforeUpload(file);
    vm.uploadFile({file, onSuccess:(response,file)=>vm.handleSuccess(response,file), onError:(error,file)=>vm.handleError(error,file),onProgress() {}});
    await tick();
    assert.equal(vm.fileList[0].status, 'exception'); assert.equal(vm.exceptionList.length, 1);
    assert.equal(options.computed.quickUploadBusy.call(vm), false); assert.deepEqual(events, []);
    URL.revokeObjectURL(vm.fileList[0].url);
});

test('quick upload continues to route large files through existing chunk and direct upload handlers', () => {
    const {vm} = uploadVM(() => {}); const calls = [];
    vm.uploadSingleFile = () => calls.push('single'); vm.uploadFileInChunks = () => calls.push('chunks'); vm.uploadToHuggingFaceDirect = () => calls.push('direct');
    for(const [uid,size,uploadChannel] of [[1,1024,'telegram'],[2,21*1024*1024,'telegram'],[3,10*1024*1024,'discord'],[4,21*1024*1024,'huggingface']]) {
        vm.fileList.push({uid,uploadChannel}); vm.uploadFile({file:{uid,size}});
    }
    assert.deepEqual(calls, ['single','chunks','chunks','direct']);
});
