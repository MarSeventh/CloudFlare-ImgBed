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
            label_en: 'Site Title',
            placeholder: 'Sanyue ImgHub',
            category: '全局设置',
            category_en: 'Global Settings',
        },
        {
            id: 'siteIcon',
            label: '网站图标',
            label_en: 'Site Icon',
            category: '全局设置',
            category_en: 'Global Settings',
        },
        {
            id: 'ownerName',
            label: '图床名称',
            label_en: 'Site Name',
            placeholder: 'Sanyue ImgHub',
            category: '全局设置',
            category_en: 'Global Settings',
        },
        {
            id: 'logoUrl',
            label: '图床Logo',
            label_en: 'Site Logo',
            category: '全局设置',
            category_en: 'Global Settings',
        },
        {
            id: 'logoLink',
            label: 'Logo跳转链接',
            label_en: 'Logo Link',
            placeholder: 'https://github.com/MarSeventh/CloudFlare-ImgBed',
            tooltip: '点击Logo时跳转的链接，留空则使用默认GitHub链接',
            tooltip_en: 'URL to navigate when clicking the logo. Leave empty for default GitHub link',
            category: '全局设置',
            category_en: 'Global Settings',
        },
        {
            id: 'bkInterval',
            label: '背景切换间隔',
            label_en: 'Background Interval',
            placeholder: '3000',
            tooltip: '单位：毫秒 ms',
            tooltip_en: 'Unit: milliseconds (ms)',
            category: '全局设置',
            category_en: 'Global Settings',
        },
        {
            id: 'bkOpacity',
            label: '背景图透明度',
            label_en: 'Background Opacity',
            placeholder: '1',
            tooltip: '0-1 之间的小数',
            tooltip_en: 'Decimal between 0 and 1',
            category: '全局设置',
            category_en: 'Global Settings',
        },
        {
            id: 'urlPrefix',
            label: '默认URL前缀',
            label_en: 'Default URL Prefix',
            tooltip: '自定义URL前缀，如：https://img.a.com/file/，留空则使用当前域名 <br/> 设置后将应用于客户端和管理端',
            tooltip_en: 'Custom URL prefix, e.g. https://img.a.com/file/. Leave empty to use current domain <br/> Applies to both client and admin',
            category: '全局设置',
            category_en: 'Global Settings',
        },
        // 客户端设置
        {
            id: 'announcement',
            label: '公告',
            label_en: 'Announcement',
            type: 'textarea',
            tooltip: '支持HTML标签',
            tooltip_en: 'Supports HTML tags',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'showDirectorySuggestions',
            label: '目录候选项',
            label_en: 'Directory Suggestions',
            type: 'boolean',
            default: true,
            tooltip: '控制上传页面是否展示目录树选择器',
            tooltip_en: 'Show directory tree picker on upload page',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultUploadChannel',
            label: '默认渠道类型',
            label_en: 'Default Channel Type',
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
            category_en: 'Client Settings',
        },
        {
            id: 'defaultChannelName',
            label: '默认渠道名称',
            label_en: 'Default Channel Name',
            type: 'channelName',
            tooltip: '指定默认使用的渠道名称，需先选择上传渠道',
            tooltip_en: 'Specify default channel name. Select upload channel first',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultUploadFolder',
            label: '默认上传目录',
            label_en: 'Default Upload Directory',
            placeholder: '/ 开头的合法目录，不能包含特殊字符， 默认为根目录',
            placeholder_en: 'Valid path starting with /, no special chars. Default: root',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultUploadNameType',
            label: '默认命名方式',
            label_en: 'Default Naming',
            type: 'select',
            options: [
                { label: '默认', value: 'default', label_en: 'Default' },
                { label: '仅前缀', value: 'index', label_en: 'Prefix Only' },
                { label: '仅原名', value: 'origin', label_en: 'Original Name' },
                { label: '短链接', value: 'short', label_en: 'Short Link' },
            ],
            placeholder: 'default',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultConvertToWebp',
            label: '默认转换WebP',
            label_en: 'Default Convert to WebP',
            type: 'boolean',
            default: false,
            tooltip: '上传前将图片转换为WebP格式，可有效减小文件体积',
            tooltip_en: 'Convert images to WebP before upload to reduce file size',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCustomerCompress',
            label: '默认开启压缩',
            label_en: 'Default Compression',
            type: 'boolean',
            default: true,
            tooltip: '上传前在本地进行压缩，仅对图片文件生效',
            tooltip_en: 'Compress locally before upload, only for images',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCompressBar',
            label: '默认压缩阈值',
            label_en: 'Default Compress Threshold',
            placeholder: '5',
            tooltip: '图片大小超过此值将自动压缩，单位MB，范围1-20',
            tooltip_en: 'Auto-compress when image exceeds this size (MB), range 1-20',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCompressQuality',
            label: '默认压缩期望',
            label_en: 'Default Compress Target',
            placeholder: '4',
            tooltip: '压缩后图片大小期望值，单位MB，范围0.5-压缩阈值',
            tooltip_en: 'Target image size after compression (MB), range 0.5 to threshold',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'loginBkImg',
            label: '登录页背景图',
            label_en: 'Login Background',
            tooltip: '1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 ["url1","url2"] 使用多张图片轮播 <br/> 3.填写 ["url"] 使用单张图片',
            tooltip_en: '1. Enter "bing" for Bing wallpaper rotation <br/> 2. Enter ["url1","url2"] for multiple images <br/> 3. Enter ["url"] for a single image',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'uploadBkImg',
            label: '上传页背景图',
            label_en: 'Upload Background',
            tooltip: '1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 ["url1","url2"] 使用多张图片轮播 <br/> 3.填写 ["url"] 使用单张图片',
            tooltip_en: '1. Enter "bing" for Bing wallpaper rotation <br/> 2. Enter ["url1","url2"] for multiple images <br/> 3. Enter ["url"] for a single image',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'footerLink',
            label: '页脚传送门链接',
            label_en: 'Footer Portal Link',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'disableFooter',
            label: '隐藏页脚',
            label_en: 'Hide Footer',
            type: 'boolean',
            default: false,
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        // 管理端设置
        {
            id: 'adminLoginBkImg',
            label: '登录页背景图',
            label_en: 'Login Background',
            tooltip: '1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 ["url1","url2"] 使用多张图片轮播 <br/> 3.填写 ["url"] 使用单张图片',
            tooltip_en: '1. Enter "bing" for Bing wallpaper rotation <br/> 2. Enter ["url1","url2"] for multiple images <br/> 3. Enter ["url"] for a single image',
            category: '管理端设置',
            category_en: 'Admin Settings',
        },
        {
            id: 'adminBkImg',
            label: '管理页背景图',
            label_en: 'Admin Background',
            tooltip: '1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 ["url1","url2"] 使用多张图片轮播 <br/> 3.填写 ["url"] 使用单张图片',
            tooltip_en: '1. Enter "bing" for Bing wallpaper rotation <br/> 2. Enter ["url1","url2"] for multiple images <br/> 3. Enter ["url"] for a single image',
            category: '管理端设置',
            category_en: 'Admin Settings',
        },
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