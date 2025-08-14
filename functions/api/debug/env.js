/**
 * 环境变量调试工具
 * 用于检查 D1 和 KV 绑定状态
 */
import { getDatabase } from '../utils/databaseAdapter.js';

export async function onRequest(context) {
    const { env } = context;
    
    try {
        // 检查环境变量
        const envInfo = {
            hasDB: !!env.DB,
            hasImgUrl: !!env.img_url,
            dbType: env.DB ? typeof env.DB : 'undefined',
            imgUrlType: env.img_url ? typeof env.img_url : 'undefined',
            dbPrepare: env.DB && typeof env.DB.prepare === 'function',
            imgUrlGet: env.img_url && typeof env.img_url.get === 'function'
        };
        
        // 尝试测试 D1 连接
        let d1Test = null;
        if (env.DB) {
            try {
                const stmt = env.DB.prepare('SELECT 1 as test');
                const result = await stmt.first();
                d1Test = { success: true, result: result };
            } catch (error) {
                d1Test = { success: false, error: error.message };
            }
        }
        
        // 尝试测试 KV 连接
        let kvTest = null;
        if (env.img_url) {
            try {
                const result = await getDatabase(env).list({ limit: 1 });
                kvTest = { success: true, hasKeys: result.keys.length > 0 };
            } catch (error) {
                kvTest = { success: false, error: error.message };
            }
        }
        
        const debugInfo = {
            timestamp: new Date().toISOString(),
            environment: envInfo,
            d1Test: d1Test,
            kvTest: kvTest,
            recommendation: getRecommendation(envInfo, d1Test, kvTest)
        };
        
        return new Response(JSON.stringify(debugInfo, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Debug failed',
            message: error.message,
            stack: error.stack
        }, null, 2), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

function getRecommendation(envInfo, d1Test, kvTest) {
    const recommendations = [];
    
    if (!envInfo.hasDB && !envInfo.hasImgUrl) {
        recommendations.push('❌ 没有配置任何数据库绑定');
        recommendations.push('🔧 请在 Cloudflare Pages Dashboard 中配置 D1 或 KV 绑定');
    }
    
    if (envInfo.hasDB) {
        if (!envInfo.dbPrepare) {
            recommendations.push('⚠️ D1 绑定存在但 prepare 方法不可用');
            recommendations.push('🔧 请检查 D1 数据库是否正确绑定');
        } else if (d1Test && !d1Test.success) {
            recommendations.push('❌ D1 数据库连接失败: ' + d1Test.error);
            recommendations.push('🔧 请检查数据库是否已初始化表结构');
            recommendations.push('💡 运行: npx wrangler d1 execute imgbed-database --file=./database/init.sql');
        } else if (d1Test && d1Test.success) {
            recommendations.push('✅ D1 数据库连接正常');
        }
    } else {
        recommendations.push('ℹ️ 没有检测到 D1 绑定 (env.DB)');
        recommendations.push('🔧 在 Pages Settings → Functions → D1 database bindings 中添加:');
        recommendations.push('   Variable name: DB');
        recommendations.push('   D1 database: imgbed-database');
    }
    
    if (envInfo.hasImgUrl) {
        if (!envInfo.imgUrlGet) {
            recommendations.push('⚠️ KV 绑定存在但 get 方法不可用');
        } else if (kvTest && !kvTest.success) {
            recommendations.push('❌ KV 连接失败: ' + kvTest.error);
        } else if (kvTest && kvTest.success) {
            recommendations.push('✅ KV 存储连接正常');
        }
    } else {
        recommendations.push('ℹ️ 没有检测到 KV 绑定 (env.img_url)');
    }
    
    if (!envInfo.hasDB && !envInfo.hasImgUrl) {
        recommendations.push('');
        recommendations.push('🚀 快速解决方案:');
        recommendations.push('1. 重新部署项目 (配置可能还没生效)');
        recommendations.push('2. 等待 2-3 分钟让绑定生效');
        recommendations.push('3. 检查 Pages 项目的 Functions 设置');
    }
    
    return recommendations;
}
