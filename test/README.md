# 后端回归测试

使用 Node.js 22 和仓库已有的 Mocha：

```sh
npm ci
npm test
npm run test:server
npx --no-install wrangler pages functions build functions --outdir data/ci-pages-build
```

`npm test` 无需启动服务或配置云服务密钥。测试使用内存数据库和存储渠道替身，不会读写本地业务数据或访问真实存储。

| 文件 | 覆盖范围 |
| --- | --- |
| `auth.test.js` | 新旧密码格式、管理员与用户权限隔离、Token 权限与过期、会话与 Cookie、管理接口鉴权与缓存策略 |
| `mimeTypes.test.js` | MIME 规范化、类型推断与优先级、扩展名、筛选、图片处理格式限制 |
| `mimeFlows.test.js` | 上传与分片合并的类型和元数据、Telegram 路由、HuggingFace 直传、索引筛选、AI 输入检查、随机图、文件 GET/HEAD/Range |
| `smoke/serverImports.mjs` | 使用生产服务端 loader 加载真实路由，检查导入和处理器导出 |

`helpers/loadFunction.js` 为隔离测试替换具名导入，执行的处理器代码和 MIME 工具仍来自真实源文件。认证测试也使用真实的认证核心、会话与 Token 校验实现，仅替换配置和数据库访问。修改被测模块的导入方式时，需要同步检查该辅助工具是否仍适用。

隔离测试无法发现所有模块解析问题，因此 CI 还会单独检查未经改写的服务端模块导入，并构建 Pages Functions。这些检查不等于实际 Docker 镜像启动或真实渠道端到端测试。

新增用例应验证可观察行为，例如返回状态、响应头、持久化元数据和权限边界；修复缺陷时尽量给出修改前失败、修改后通过的用例。每个用例独立构造状态，恢复对全局对象的修改，避免依赖网络、真实凭据和固定等待时间。真实渠道验证结果在 PR 中单独说明。
