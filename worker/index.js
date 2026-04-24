/**
 * Cloudflare Workers 部署适配层（自动生成，请勿手动编辑）
 * 生成命令: node worker/generate-routes.js
 * 
 * 复用 functions/ 下的全部业务逻辑，不修改任何业务代码
 */

// ==================== 自动生成的导入 ====================

// --- 中间件（自动生成） ---
import * as mw_api from '../functions/api/_middleware.js';
import * as mw_api_manage from '../functions/api/manage/_middleware.js';
import * as mw_dav from '../functions/dav/_middleware.js';
import * as mw_file from '../functions/file/_middleware.js';
import * as mw_random from '../functions/random/_middleware.js';
import * as mw_upload from '../functions/upload/_middleware.js';

// --- 路由模块（自动生成） ---
import * as apiManageBatchIndexChunk from '../functions/api/manage/batch/index/chunk.js';
import * as apiManageBatchIndexConfig from '../functions/api/manage/batch/index/config.js';
import * as apiManageBatchIndexFinalize from '../functions/api/manage/batch/index/finalize.js';
import * as apiManageBatchRestoreChunk from '../functions/api/manage/batch/restore/chunk.js';
import * as apiManageBatchList from '../functions/api/manage/batch/list.js';
import * as apiManageBatchSettings from '../functions/api/manage/batch/settings.js';
import * as apiManageCusConfigBlockip from '../functions/api/manage/cusConfig/blockip.js';
import * as apiManageCusConfigBlockipList from '../functions/api/manage/cusConfig/blockipList.js';
import * as apiManageCusConfigList from '../functions/api/manage/cusConfig/list.js';
import * as apiManageCusConfigWhiteip from '../functions/api/manage/cusConfig/whiteip.js';
import * as apiManageSysConfigOthers from '../functions/api/manage/sysConfig/others.js';
import * as apiManageSysConfigPage from '../functions/api/manage/sysConfig/page.js';
import * as apiManageSysConfigSecurity from '../functions/api/manage/sysConfig/security.js';
import * as apiManageSysConfigUpload from '../functions/api/manage/sysConfig/upload.js';
import * as apiManageTagsAutocomplete from '../functions/api/manage/tags/autocomplete.js';
import * as apiManageTagsBatch from '../functions/api/manage/tags/batch.js';
import * as apiAuthAdminLogin from '../functions/api/auth/adminLogin.js';
import * as apiAuthLogin from '../functions/api/auth/login.js';
import * as apiAuthLogout from '../functions/api/auth/logout.js';
import * as apiAuthResetAuth from '../functions/api/auth/resetAuth.js';
import * as apiAuthSessionCheck from '../functions/api/auth/sessionCheck.js';
import * as apiBingWallpaper_index from '../functions/api/bing/wallpaper/index.js';
import * as apiManageApiTokens from '../functions/api/manage/apiTokens.js';
import * as apiManageList from '../functions/api/manage/list.js';
import * as apiManageQuota from '../functions/api/manage/quota.js';
import * as apiPublicList from '../functions/api/public/list.js';
import * as uploadHuggingfaceCommitUpload from '../functions/upload/huggingface/commitUpload.js';
import * as uploadHuggingfaceGetUploadUrl from '../functions/upload/huggingface/getUploadUrl.js';
import * as apiChannels from '../functions/api/channels.js';
import * as apiDirectoryTree from '../functions/api/directoryTree.js';
import * as apiFetchRes from '../functions/api/fetchRes.js';
import * as apiUserConfig from '../functions/api/userConfig.js';
import * as random_index from '../functions/random/index.js';
import * as upload_index from '../functions/upload/index.js';
import * as apiManageBlockCatchAll from '../functions/api/manage/block/[[path]].js';
import * as apiManageDeleteCatchAll from '../functions/api/manage/delete/[[path]].js';
import * as apiManageMetadataCatchAll from '../functions/api/manage/metadata/[[path]].js';
import * as apiManageMoveCatchAll from '../functions/api/manage/move/[[path]].js';
import * as apiManageRenameCatchAll from '../functions/api/manage/rename/[[path]].js';
import * as apiManageTagsCatchAll from '../functions/api/manage/tags/[[path]].js';
import * as apiManageWhiteCatchAll from '../functions/api/manage/white/[[path]].js';
import * as davCatchAll from '../functions/dav/[[path]].js';
import * as fileCatchAll from '../functions/file/[[path]].js';


// ==================== 自动生成的路由表 ====================

const routes = [
    { path: '/api/manage/batch/index/chunk', module: apiManageBatchIndexChunk, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/batch/index/config', module: apiManageBatchIndexConfig, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/batch/index/finalize', module: apiManageBatchIndexFinalize, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/batch/restore/chunk', module: apiManageBatchRestoreChunk, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/batch/list', module: apiManageBatchList, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/batch/settings', module: apiManageBatchSettings, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/cusConfig/blockip', module: apiManageCusConfigBlockip, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/cusConfig/blockipList', module: apiManageCusConfigBlockipList, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/cusConfig/list', module: apiManageCusConfigList, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/cusConfig/whiteip', module: apiManageCusConfigWhiteip, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/sysConfig/others', module: apiManageSysConfigOthers, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/sysConfig/page', module: apiManageSysConfigPage, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/sysConfig/security', module: apiManageSysConfigSecurity, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/sysConfig/upload', module: apiManageSysConfigUpload, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/tags/autocomplete', module: apiManageTagsAutocomplete, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/tags/batch', module: apiManageTagsBatch, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/auth/adminLogin', module: apiAuthAdminLogin, middlewares: [mw_api] },
    { path: '/api/auth/login', module: apiAuthLogin, middlewares: [mw_api] },
    { path: '/api/auth/logout', module: apiAuthLogout, middlewares: [mw_api] },
    { path: '/api/auth/resetAuth', module: apiAuthResetAuth, middlewares: [mw_api] },
    { path: '/api/auth/sessionCheck', module: apiAuthSessionCheck, middlewares: [mw_api] },
    { path: '/api/bing/wallpaper', module: apiBingWallpaper_index, middlewares: [mw_api] },
    { path: '/api/manage/apiTokens', module: apiManageApiTokens, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/list', module: apiManageList, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/manage/quota', module: apiManageQuota, middlewares: [mw_api, mw_api_manage] },
    { path: '/api/public/list', module: apiPublicList, middlewares: [mw_api] },
    { path: '/upload/huggingface/commitUpload', module: uploadHuggingfaceCommitUpload, middlewares: [mw_upload] },
    { path: '/upload/huggingface/getUploadUrl', module: uploadHuggingfaceGetUploadUrl, middlewares: [mw_upload] },
    { path: '/api/channels', module: apiChannels, middlewares: [mw_api] },
    { path: '/api/directoryTree', module: apiDirectoryTree, middlewares: [mw_api] },
    { path: '/api/fetchRes', module: apiFetchRes, middlewares: [mw_api] },
    { path: '/api/userConfig', module: apiUserConfig, middlewares: [mw_api] },
    { path: '/random', module: random_index, middlewares: [mw_random] },
    { path: '/upload', module: upload_index, middlewares: [mw_upload] },
    { path: '/api/manage/block/', module: apiManageBlockCatchAll, middlewares: [mw_api, mw_api_manage], catchAll: true },
    { path: '/api/manage/delete/', module: apiManageDeleteCatchAll, middlewares: [mw_api, mw_api_manage], catchAll: true },
    { path: '/api/manage/metadata/', module: apiManageMetadataCatchAll, middlewares: [mw_api, mw_api_manage], catchAll: true },
    { path: '/api/manage/move/', module: apiManageMoveCatchAll, middlewares: [mw_api, mw_api_manage], catchAll: true },
    { path: '/api/manage/rename/', module: apiManageRenameCatchAll, middlewares: [mw_api, mw_api_manage], catchAll: true },
    { path: '/api/manage/tags/', module: apiManageTagsCatchAll, middlewares: [mw_api, mw_api_manage], catchAll: true },
    { path: '/api/manage/white/', module: apiManageWhiteCatchAll, middlewares: [mw_api, mw_api_manage], catchAll: true },
    { path: '/dav/', module: davCatchAll, middlewares: [mw_dav], catchAll: true },
    { path: '/file/', module: fileCatchAll, middlewares: [mw_file], catchAll: true },
];


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
