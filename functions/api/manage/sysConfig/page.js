import { getDatabase } from '../../../utils/databaseAdapter.js';

export async function onRequest(context) {
    // 页面设置相关，GET方法读取设置，POST方法保存设置
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context;

    const db = getDatabase(env);

    // GET读取设置
    if (request.method === 'GET') {
        const settings = await getPageConfig(db, env)

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // POST保存设置
    if (request.method === 'POST') {
        const body = await request.json()
        const settings = body
        // 写入数据库
        await db.put('manage@sysConfig@page', JSON.stringify(settings))

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getPageConfig(db, env) {
    const settings = {}
    // 读取数据库中的设置
    const settingsStr = await db.get('manage@sysConfig@page')
    const settingsKV = settingsStr ? JSON.parse(settingsStr) : {}

    const config = []
    settings.config = config
    config.push(
        // 全局设置
        {
            id: 'siteTitle',
            label: '网站标题',
            placeholder: 'Sanyue ImgHub',
            category: '全局设置',
        },
        {
            id: 'siteIcon',
            label: '网站图标',
            category: '全局设置',
        },
        {
            id: 'ownerName',
            label: '图床名称',
            placeholder: 'Sanyue ImgHub',
            category: '全局设置',
        },
        {
            id: 'logoUrl',
            label: '图床Logo',
            category: '全局设置',
        },
        {
            id: 'logoLink',
            label: 'Logo跳转链接',
            placeholder: 'https://github.com/MarSeventh/CloudFlare-ImgBed',
            tooltip: '点击Logo时跳转的链接，留空则使用默认GitHub链接',
            category: '全局设置',
        },
        {
            id: 'bkInterval',
            label: '背景切换间隔',
            placeholder: '3000',
            tooltip: '单位：毫秒 ms',
            category: '全局设置',
        },
        {
            id: 'bkOpacity',
            label: '背景图透明度',
            placeholder: '1',
            tooltip: '0-1 之间的小数',
            category: '全局设置',
        },
        {
            id: 'urlPrefix',
            label: '默认URL前缀',
            tooltip: '自定义URL前缀，如：https://img.a.com/file/，留空则使用当前域名 <br/> 设置后将应用于客户端和管理端',
            category: '全局设置',
        },
        // 客户端设置
        {
            id: 'announcement',
            label: '公告',
            type: 'textarea',
            tooltip: '支持HTML标签',
            category: '客户端设置',
        },
        {
            id: 'defaultUploadChannel',
            label: '默认渠道类型',
            type: 'select',
            options: [
                { label: 'Telegram', value: 'telegram' },
                { label: 'Cloudflare R2', value: 'cfr2' },
                { label: 'S3', value: 's3' },
                { label: 'Discord', value: 'discord' },
                { label: 'HuggingFace', value: 'huggingface' },
            ],
            placeholder: 'telegram',
            category: '客户端设置',
        },
        {
            id: 'defaultChannelName',
            label: '默认渠道名称',
            type: 'channelName',
            tooltip: '指定默认使用的渠道名称，需先选择上传渠道',
            category: '客户端设置',
        },
        {
            id: 'defaultUploadFolder',
            label: '默认上传目录',
            placeholder: '/ 开头的合法目录，不能包含特殊字符， 默认为根目录',
            category: '客户端设置',
        },
        {
            id: 'defaultUploadNameType',
            label: '默认命名方式',
            type: 'select',
            options: [
                { label: '默认', value: 'default' },
                { label: '仅前缀', value: 'index' },
                { label: '仅原名', value: 'origin' },
                { label: '短链接', value: 'short' },
            ],
            placeholder: 'default',
            category: '客户端设置',
        },
        {
            id: 'defaultConvertToWebp',
            label: '默认转换WebP',
            type: 'boolean',
            default: false,
            tooltip: '上传前将图片转换为WebP格式，可有效减小文件体积',
            category: '客户端设置',
        },
        {
            id: 'defaultCustomerCompress',
            label: '默认开启压缩',
            type: 'boolean',
            default: true,
            tooltip: '上传前在本地进行压缩，仅对图片文件生效',
            category: '客户端设置',
        },
        {
            id: 'defaultCompressBar',
            label: '默认压缩阈值',
            placeholder: '5',
            tooltip: '图片大小超过此值将自动压缩，单位MB，范围1-20',
            category: '客户端设置',
        },
        {
            id: 'defaultCompressQuality',
            label: '默认期望大小',
            placeholder: '4',
            tooltip: '压缩后图片大小期望值，单位MB，范围0.5-压缩阈值',
            category: '客户端设置',
        },
        {
            id: 'loginBkImg',
            label: '登录页背景图',
            tooltip: '1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 ["url1","url2"] 使用多张图片轮播 <br/> 3.填写 ["url"] 使用单张图片',
            category: '客户端设置',
        },
        {
            id: 'uploadBkImg',
            label: '上传页背景图',
            tooltip: '1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 ["url1","url2"] 使用多张图片轮播 <br/> 3.填写 ["url"] 使用单张图片',
            category: '客户端设置',
        },
        {
            id: 'footerLink',
            label: '页脚传送门链接',
            category: '客户端设置',
        },
        {
            id: 'disableFooter',
            label: '隐藏页脚',
            type: 'boolean',
            default: false,
            category: '客户端设置',
        },
        // 管理端设置
        {
            id: 'adminLoginBkImg',
            label: '登录页背景图',
            tooltip: '1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 ["url1","url2"] 使用多张图片轮播 <br/> 3.填写 ["url"] 使用单张图片',
            category: '管理端设置',
        },
        {
            id: 'adminBkImg',
            label: '管理页背景图',
            tooltip: '1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 ["url1","url2"] 使用多张图片轮播 <br/> 3.填写 ["url"] 使用单张图片',
            category: '管理端设置',
        }
    )

    const userConfig = env.USER_CONFIG
    if (userConfig) {
        try {
            const parsedConfig = JSON.parse(userConfig)
            if (typeof parsedConfig === 'object' && parsedConfig !== null) {
                // 搜索config中的id，如果存在则更新
                for (let i = 0; i < config.length; i++) {
                    if (parsedConfig[config[i].id]) {
                        config[i].value = parsedConfig[config[i].id]
                    }
                }
            }
        } catch (error) {
            // do nothing
        }
    }

    // 用KV中的设置覆盖默认设置
    for (let i = 0; i < settingsKV.config?.length; i++) {
        const item = settingsKV.config[i]
        const index = config.findIndex(x => x.id === item.id)
        if (index !== -1) {
            config[index].value = item.value
        }
    }

    return settings
}