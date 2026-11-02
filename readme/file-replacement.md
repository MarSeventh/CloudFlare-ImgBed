# 单文件替换

在源文件的卡片、列表操作栏或手机操作菜单中点击“替换文件”，浏览文件夹并选择一个被替换文件，再点击“确认替换”。不提供文件夹或批量替换。

- 默认保留源文件，效果类似复制；勾选“替换成功后将源文件移入回收站”，效果类似可恢复的移动。不会物理删除源文件。
- 目标保留固定 ID、永久链接、历史路径、名称、目录、标签、上传时间与访问名单。内容、存储渠道、大小、图片尺寸和内容审查标签取自源文件；不会沿用目标的旧尺寸。目标类型须与源文件 MIME 类型一致，例如 PNG 替换 PNG、PDF 替换 PDF。
- 源文件进入回收站后，其固定链接和历史链接暂时失效；恢复后重新可用，不会改为跳转到目标。目标原有链接继续指向目标的新内容。
- 替换只保证本项目 `/file/...` 链接保持不变。直接复制的第三方存储地址不属于此保证，可能因旧内容清理而失效。

## 存储和失败处理

先创建独立内容副本，检查源和目标没有变化，再更新目标记录，最后按选择归档源记录到回收站、清理旧目标存储内容。源文件存储保留到回收站永久删除；目标旧版本不纳入回收站。R2、S3、WebDAV 使用独立对象；Discord 使用新消息；HuggingFace 使用新路径。Telegram 使用不可变的文件 ID，图库的删除操作不会删除 Telegram 中的文件内容。

`sourceDeleted` 保留兼容，含义是源文件已移出活动图库；新增 `sourceTrashed` 明确表示已进入回收站。永久删除需单独的 `purge` 权限，且只能调用回收站接口。详见 [回收站](recycle-bin.md)。

R2 替换后的记录用 `R2FileKey` 指向独立对象；读取、改名、移动和删除均兼容该字段。后续改名或移动会重新把对象放到对应路径并清除这个字段。

复制失败不会覆盖目标或删除源文件。目标已经更新但源记录删除、索引更新或远端旧内容清理失败时，界面显示具体的部分成功提示。数据库写入结果不确定时保留已复制内容，避免目标记录可能已生效但内容被回滚删除。

Discord、HuggingFace 复制需要重新上传，当前限制每个文件或分片不超过 20 MiB。WebDAV 服务需支持 COPY。外链及 Telegraph 不支持作为替换源；旧 Telegram 文件 ID 在复制时转为显式存储凭据。目标的新内容使用源文件的渠道，可能与目标原来的渠道不同。

替换调用现有缓存清理逻辑，覆盖目标固定链接和历史路径，删除源文件时也清理源引用缓存。Cloudflare 缓存清理需要已有 Zone ID、邮箱和 API Key 配置；浏览器已缓存的旧内容无法远程撤回。管理端的预览带内容版本参数，以便刷新后读取新内容；复制的永久地址保持原样。

同一 isolate、同一数据库绑定上的两种替换、重命名（包括同名元数据修复）、单文件/目录移动与删除共用路径锁，源和目标路径一次性加锁，持有至写入及同步清理结束；冲突返回 409。目录操作逐文件加锁，冲突项进入 failed，已完成项不会撤销，不保证整目录原子性。身份初始化及重写文件元数据的标签更新也使用此锁。提交前及删除源文件前检查记录快照，旧界面中的内容版本也会被拒绝。KV/D1 与外部对象存储之间没有跨服务事务，也没有跨实例的原子 CAS/事务；KV 还具有最终一致性，因此不应在多个客户端同时替换、移动或删除同一文件。这些检查不能提供跨实例原子互斥。

## 管理接口

`POST /api/manage/replace/{sourcePathOrFixedId}`，JSON 示例：

```json
{
  "target": "documents/report.pdf",
  "deleteSource": false,
  "expectedSourcePath": "incoming/new-report.pdf",
  "expectedTargetPath": "documents/report.pdf",
  "sourceVersion": "",
  "targetVersion": ""
}
```

版本取自列表元数据 `ContentVersion`，未替换过的文件传空字符串。响应包含 `success`、`targetPath`、目标 `fixedId`、实际 `sourceDeleted` 和 `warnings`。替换需要独立的“内容替换”（`replace`）权限；删除源文件还需“文件删除”（`delete`），两项在替换前检查。浏览并选择文件另需“文件浏览”（`list`）。文件整理与新 Token 的系统管理权限均不包含内容替换。旧管理 Token 的原有替换能力展开为显式 `replace` 授权，编辑时可取消；旧整理 Token 不获得替换能力。`/api/agent` 仍只提供浏览和整理接口，其能力发现会提示已授权的替换接口。

## 验证

```sh
node --import ./deploy/server/register.mjs --test tests/file-replacement.test.mjs tests/file-replacement-ui.test.mjs tests/file-identity.test.mjs tests/permanent-link-integration.test.mjs tests/agent-organization.test.mjs tests/unified-names.test.mjs tests/file-details.test.mjs tests/overview.test.mjs
npx wrangler pages functions build functions --outdir .wrangler/replacement-build
cd frontend && npm run build
```

测试使用 KV/D1 和第三方存储模拟，覆盖新旧引用读取、PDF、独立副本、源文件删除、R2 后续操作、权限、冲突和失败恢复；不代表已对生产存储完成在线验证。

## 从原目标上传本地文件（HTTP Agent 同样可用）

原文件卡片、列表操作栏或手机菜单的“从本地替换内容”打开本地文件选择器，选择文件后确认。原有“替换文件”的源记录 → 目标记录 → 可选移入回收站流程保持不变。

`POST /api/manage/replace-file/{id}` 使用目标固定 ID（`f_...`）和 `multipart/form-data`，只需要 `replace`，不需要 `upload`、`delete` 或 `manage`。已知固定 ID 时，可用相同地址的 `GET /api/manage/replace-file/{id}` 获取最小预检快照，仅需 `replace`，只返回 `id`、`path`、`contentVersion`、`type`，不会返回备注、标签、存储凭据或其他元数据。浏览文件库及 `GET /api/agent/files`、`GET /api/agent/files/{id}` 仍需要独立的 `list` 权限。使用管理员会话或 `Authorization: Bearer`，不要把凭据放进 URL。

```sh
# 已知目标固定 ID，先以 replace 权限读取最小快照（GET 本身不替换）：
# IMG_BED_TOKEN 由安全环境注入，不在命令中写密钥值。
curl --fail-with-body 'https://imgbed.example/api/manage/replace-file/f_0123456789abcdef0123456789abcdef' \
  -H "Authorization: Bearer ${IMG_BED_TOKEN}"
# 核对 path/type，把快照的 path 和 contentVersion 填入下面表单；初始版本为 ""。
# IMG_BED_TOKEN 由 Agent 的安全环境注入，切勿开启 shell 跟踪或记录请求头。
curl --fail-with-body 'https://imgbed.example/api/manage/replace-file/f_0123456789abcdef0123456789abcdef' \
  -H "Authorization: Bearer ${IMG_BED_TOKEN}" \
  -F 'expectedPath=documents/report.pdf' \
  -F 'expectedVersion=' \
  -F 'file=@./updated-report.pdf;type=application/pdf'
```

必须提供单个 `file`、`expectedPath`、`expectedVersion`，所有参数在表单中；不支持 URL 参数、远程图片地址、`dryRun`、分片或批量操作。路径或内容版本过时返回 409，必须重新读取并重新确认，不能自动重试写入。网页打开时总是获取当前快照；旧列表缺少 FixedId 时先通过已认证的 identity 接口初始化，失败时禁用提交。409 后刷新快照并保留对话框，需用户再次确认。文件 MIME 按现有记录替换规则比较：忽略参数和大小写，主类型必须一致；不按扩展名推断 MIME，也不做内容魔数鉴定。HTTP Agent 应显式提供正确的 file 部分 Content-Type。

目标保留 FixedId、永久/历史链接、文件名、路径、目录、标签、上传时间/IP、访问名单、备注和其他非内容字段。仅更新存储引用、大小、可解析的图片尺寸、审查 Label、ContentVersion 和 ContentUpdatedAt；新内容不能解析尺寸时清除旧尺寸。不创建任何源记录、新 FixedId 或回收站条目。响应含 `fixedId`、`targetPath`、`contentVersion`、`contentUpdatedAt`、`warnings`。Agent 单文件详情也返回 `contentVersion` 与 `contentUpdatedAt`。

当前使用目标已有渠道，不自动切换渠道：

- R2、S3、WebDAV：随机目录下使用固定 `content` 名称；创建时使用“不存在才写入”的条件。S3/WebDAV 服务必须正确支持条件 PUT，否则不能提供碰撞保护。原生预览 R2 也使用独占创建。
- Discord：独立新消息；Telegram：以 document 上传，保留原始字节。Telegram 旧文件内容按现有删除策略留在 Telegram；提交前回滚会尝试删除新消息。
- HuggingFace 暂不支持此直接上传接口（现有 API 无条件创建保护），External/Telegraph 不支持。返回 422，目标和旧存储不变；仍可使用既有记录替换功能支持的渠道。
- 每个本地文件最大 20 MiB，整个 multipart 请求最多再加 64 KiB 表单开销。没有 Content-Length 时同样限制；不走普通上传的压缩、分片或自动重试。
- 图片审查复用普通上传的审查器并针对暂存内容执行，不复用旧 Label。开启审查时 R2/S3/WebDAV 必须配置可公开读取暂存对象的 publicUrl/cdnDomain；Discord 使用新附件 URL；Telegram 没有无凭据公开暂存 URL，此时返回 422。审查服务出错时沿用现有上传策略，Label 为 None。

先独立存储字节，在持锁期间复查目标快照并写入数据库，成功后刷新索引、清理固定链接与历史路径缓存，最后清理旧存储。其他活动或回收站记录仍引用旧对象时保留它并返回 warning；无法安全核查引用时同样保留。暂存名称完全不使用上传文件名或目标文件名，避免路径穿越和清理别名。暂存阶段明确失败或提交前快照冲突会回滚已确认创建的对象；存储写入响应丢失时可能遗留未引用对象，不盲删不确定归属的对象。

数据库写入一旦开始，失败响应返回 `outcome:"unknown"`、`stagedRetained:true`，新旧对象均保留，调用者必须刷新核对目标后再决定操作。成功后的索引、缓存或旧存储清理错误以 `warnings` 返回，不回滚新目标。跨服务没有事务，KV 的最终一致性与跨实例并发限制仍适用；应串行替换/移动/删除同一文件。

最小预检和上传均受 `/api/manage` 认证中间件保护：缺失、失效及权限不足的 Token 都返回 401（包括有效但不含 replace 的 Token）；`/api/agent` 对有效但缺少 list/organize 的 Token 返回 403。预检不支持 dryRun，上传也没有 dryRun。缺少 CDN 清理配置时上传成功会返回 warning，不修改全局缓存策略；预先进入浏览器缓存的响应无法远程清除。

旧内容引用核查 `oldContentIsShared()` 保守扫描活动库和回收站，按 1000 条分页，复杂度随库规模增长，Discord 分片还需读取记录值；此扫描在成功响应前、路径锁内执行，大库可能增加延迟及存储调用成本。当前没有可靠的引用计数或有界替代方案；扫描失败、不完整或发现共享引用时保留旧内容并返回 warning，不能为降低延迟而跳过核查或盲删。跨实例仍可能在扫描/清理之间创建引用，当前没有分布式事务保证；请串行执行同一文件和共享底层内容的写操作。

路径锁覆盖上述入口，未改造的既有写入仍包括 metadata 修复、block/white 访问名单、批量标签/标签目录、备份恢复、normalizeNames 与 Agent 列表的旧身份初始化，以及回收站恢复/永久清理；它们仍需与替换串行运行。此锁不构成跨数据库与对象存储的事务，替换的快照复查也不能消除这些未接入入口在复查之后写入的窗口。
