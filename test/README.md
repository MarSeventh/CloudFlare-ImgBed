# 后端测试说明与覆盖总览

本目录按功能组织回归测试，作为后续扩展的入口。MIME、参数格式等边界用例归入对应业务模块；共享文件类型与扩展名规则单独测试，避免重复断言。

**新增、删除、重命名或修改测试文件和用例时，必须在同一个 PR 中同步维护本 README。** 更新受影响的模块说明、覆盖范围、未覆盖场景或执行方式，确保文档反映最终测试行为。测试辅助工具和 CI 检查变化时也适用。审阅时同时检查代码与总览，不用无意义的文字改动代替内容核对。

## 运行方式

使用 Node.js 22 和仓库已有的 Mocha，在主仓库根目录执行：

```sh
npm ci
npm test
npm run test:server
npx --no-install wrangler pages functions build functions --outdir data/ci-pages-build
```

`npm test` 无需启动服务或配置云服务密钥。测试使用独立的内存数据库和存储替身，不读写 `data/` 中的业务数据，也不访问真实存储。

只运行一个模块，或按用例名称筛选：

```sh
npm test -- test/upload.test.js
npm test -- test/read.test.js
npm test -- test/delete.test.js
npm test -- test/update.test.js
npm test -- test/update.test.js --grep "rename"
```

现有 Mocha 入口自动加载 `test/` 根目录的 `.js` 测试文件；`helpers/` 不作为独立用例执行，`smoke/serverImports.mjs` 通过 `npm run test:server` 单独执行。新增子目录中的用例时，必须同步调整测试入口并确认 CI 能发现它们。

## 功能模块总览

| 功能 | 测试文件 | 主要生产入口 | 已覆盖行为 |
| --- | --- | --- | --- |
| 上传 | [upload.test.js](upload.test.js) | `functions/upload/` | 上传权限与 IP 拦截；目录清理、原名冲突避让；R2 / S3 / WebDAV 类型与元数据；Telegram 特殊格式和压缩开关；R2 / S3 分片初始化、上传、合并；HuggingFace 直传与提交 |
| 读取与查询 | [read.test.js](read.test.js) | `functions/file/`、`api/manage/list.js`、`random/` | R2 的 GET / HEAD / Range 与响应类型；异常 ID 与不存在记录；外链重定向；管理员预览权限和私有缓存；列表目录边界、分页、递归、总数、搜索和类型筛选；随机图 `content=` 兼容性 |
| 删除 | [delete.test.js](delete.test.js) | `api/manage/delete/` | R2 删除和幂等；R2 删除异常时保留数据；S3 实际对象 Key；批量 ID 清理与去重、参数限制、部分成功与全部失败；成功后更新真实索引并清理缓存 |
| 修改 | [update.test.js](update.test.js) | `api/manage/metadata/`、`rename/`、`move/` | 元数据可编辑字段、保留原数据、清除历史凭据；R2 重命名、跨目录与根目录移动；名称冲突与无效请求；复制失败保留源文件；旧 Telegram 能力限制；修改后的真实索引一致性 |
| 认证与会话 | [auth.test.js](auth.test.js) | `utils/auth/`、`api/manage/_middleware.js` | 新旧密码格式、管理员与用户隔离、未配置认证的行为；Token 权限与过期；authCode 来源与优先级；会话有效性、Cookie、TTL 和退出；管理接口权限映射、预检和缓存策略 |
| 图片处理 | [imageProcessing.test.js](imageProcessing.test.js) | `functions/file/imageTransform.js` | 参数校验、不同处理器的格式支持、历史通用类型、原图回退、传入格式和输出响应头 |
| AI 标签 | [ai.test.js](ai.test.js) | `api/manage/ai/tags.js` | 原图格式、预览类型规范化、文件签名与大小限制；合法输入才调用 AI |
| 共享文件类型规则 | [fileTypes.test.js](fileTypes.test.js) | `utils/mimeTypes.js` | MIME 规范化、大小写敏感参数、显式类型优先、扩展名推断、未知与歧义扩展名、随机关键词与严格分类的差别 |
| 服务端导入 | [smoke/serverImports.mjs](smoke/serverImports.mjs) | 以上主要路由及 `functions/dav/` | 使用生产 loader 检查未经改写的路由导入与处理器导出 |

上表中的业务路径以 `functions/` 为根。修改单一功能优先扩展对应文件；较大的独立功能可以新增模块，并在表中添加入口、范围与边界，不继续把无关功能堆在同一文件中。

### 当前覆盖边界

- 上传用例覆盖表中列出的渠道行为，尚未覆盖所有渠道的限流、重试、中断恢复与自动切换。
- 文件内容读取主要验证 R2；列表验证真实索引和管理 API，但尚未完整覆盖索引重建、损坏恢复、全量标签筛选和各数据库适配器。
- 删除覆盖单文件和批量接口，尚未覆盖递归文件夹删除，也未完整验证各远端渠道的删除失败语义。
- 修改覆盖元数据与 R2 的单文件重命名、移动；尚未覆盖递归目录移动、所有渠道的迁移过程和每一步失败后的恢复。
- 图片处理、AI 和随机图目前只覆盖表中列出的行为，后续功能变动应继续补充相应模块。
- 所有存储请求、缓存失效和 AI 调用均使用替身。当前没有真实云服务端到端测试，也没有完整 Docker 镜像启动、浏览器界面或 Cloudflare 线上部署验证。

覆盖不足应在本节保留具体说明，补齐相应测试后再更新范围，不能仅凭 CI 通过宣称所有基础能力已验证。

## 辅助工具与隔离边界

| 工具 | 用途与限制 |
| --- | --- |
| [helpers/loadFunction.js](helpers/loadFunction.js) | 替换源模块的具名导入以注入存储、配置等依赖，执行真实处理器；MIME 导入使用真实共享工具。修改生产导入方式时需要确认替换逻辑仍适用 |
| `memoryDatabase()` | 每个用例独立的数据库记录与元数据；读取元数据返回副本，列举按键排序。仅模拟测试使用的接口，不验证 KV / D1 / SQLite 的分页、TTL 或一致性语义 |
| [helpers/context.js](helpers/context.js) | 构造 Request、路由参数和环境，收集 `waitUntil` 任务。断言后台结果前要等待这些任务，不能把任务已入队当作执行成功 |
| [helpers/files.js](helpers/files.js) | 构造测试使用的 PNG 头部与尺寸数据；该样本用于头部检测，不代表完整、可解码图片 |
| [helpers/management.js](helpers/management.js) | 删除与修改共用的管理环境：真实索引、元数据清理和管理视图；内存 R2 对象、渠道配置与缓存替身。`readFiles()` 等待后台任务并通过真实索引查询验证最终结果 |

认证测试使用真实的认证核心、密码验证、会话与 Token 校验，替换配置和数据库访问。上传、读取等路由用例可以单独替换认证依赖验证入口分支；完整认证边界由 `auth.test.js` 保护。

隔离加载不能检查所有模块解析问题，因此 CI 还执行生产服务端 loader 导入检查和 Pages Functions 构建。新增业务路由的测试时，按需将真实入口加入 `smoke/serverImports.mjs`，保留这两层验证。

## 如何扩展与维护

1. 按行为选择模块，为新场景写清楚预期结果。一个用例验证一个明确行为，相关边界可以使用参数化输入；较大的新功能单独建文件。
2. 优先执行真实业务代码，仅在配置、数据库、存储、缓存、AI 等外部边界注入替身。避免同时模拟掉被验证的核心逻辑。
3. 验证可观察结果，包括状态码、响应头、响应数据、持久化记录、文件内容和索引。删除、修改等操作还要检查失败时原数据是否保留，以及未涉及的数据是否被意外改动。
4. 修复缺陷时，尽量提供修改前失败、修改后通过的回归用例；保留原先正确行为的断言，避免只测新分支或复制实现逻辑。
5. 每个用例独立创建状态，恢复修改的全局对象；不使用真实密钥、线上数据、任意固定等待或外部网络依赖。需要定时器时避免遗留任务拖住测试进程。
6. **同步维护本 README**：更新模块总览、覆盖边界和受影响的辅助工具说明；若改变入口、依赖或执行方式，也要更新运行命令与 CI。
7. 先运行受影响模块，再执行 `npm test` 和 `npm run test:server`。修改生产共享模块、导入或构建相关内容时，额外验证 Pages Functions 构建。PR 中说明实际执行结果与未验证环境。

## CI 检查

主仓库 `.github/workflows/regression.yml` 对目标为 `dev` / `main` 的 PR，以及这两个分支的推送运行检查：

1. 使用锁文件安装依赖。
2. 执行 `npm test`。
3. 执行 `npm run test:server`。
4. 构建 Pages Functions。

测试总数以实际执行结果为准，本文件维护功能范围，不把固定用例数量作为通过标准。CI 不代替代码审阅；需要真实渠道或部署验证的改动，应在 PR 中补充说明。
