# Telegram 私聊上传（Cloudflare Pages）

给现有存储渠道的 Bot 私聊发送图片或文件，系统将消息复制到该渠道，并登记为图床文件，回复 `/file/…` 访问链接。支持图片、文档、动画、视频、音频和语音。相册会逐张导入、逐张回复；需要原图时选择 Telegram 的“作为文件发送”。

## 1. 配置 Pages 环境变量

在 **Workers 和 Pages → 图床项目 → 设置 → 变量和机密** 中添加以下生产环境变量。保存后重新部署。原有存储渠道、数据库绑定保持不变。

| 变量 | 内容 |
| --- | --- |
| `TG_WEBHOOK_SECRET` | 必填。自行生成 32–256 位随机字符串，只含字母、数字、`_`、`-`；作为机密保存 |
| `TG_UPLOAD_ALLOWED_USER_IDS` | 可选（与后台名单至少配置一处）。允许上传的 Telegram 数字用户 ID；多个 ID 用英文逗号隔开，不能填 @用户名。见下方“授权用户名单” |
| `TG_UPLOAD_PUBLIC_URL` | 必填。图床 HTTPS 根网址，例如 `https://img.example.com`，不带 `/login` |
| `TG_UPLOAD_CHANNEL_NAME` | 可选。管理后台中已启用 Telegram 渠道的准确名称；有多个已启用渠道时必填 |
| `TG_UPLOAD_FOLDER` | 可选。保存目录，默认 `Telegram` |

代码直接读取现有 Telegram 渠道的 Bot Token、频道 ID 和代理设置，不需要把 Token 写进 GitHub。Bot 必须拥有频道发消息权限。缺少密钥或用户白名单时，上传入口关闭。

### 授权用户名单

授权用户有两个来源，**取并集**生效：

- 环境变量 `TG_UPLOAD_ALLOWED_USER_IDS`：在后台显示为带“环境变量”标签的只读条目，只能在部署平台修改。它不会写入数据库，因此从环境变量删除某个 ID 后，该 ID 立即失去授权（除非后台名单里也有它）。
- 后台 **系统设置 → 安全设置 → 上传管理 → Telegram Bot 授权用户**：可添加、移除并填写备注，点击保存后生效，最多 200 个。

两处都为空时上传入口关闭。环境变量中只要有一个非数字条目，整个上传入口也会关闭，并在后台提示，避免把写错的配置当作“部分生效”。

同一名单也限定了文件管理中“发送到 Telegram”的接收人：只能从名单中选择，服务端会拒绝名单外的 ID。

## 2. 注册消息接收地址

在自己的电脑运行以下脚本，按照提示输入该渠道的 Bot Token、上面的 Webhook 密钥和图床根网址。密钥不会显示在终端或写入文件。

```powershell
powershell -ExecutionPolicy Bypass -File ./deploy/telegram/setup-webhook.ps1
```

脚本调用 Telegram `setWebhook`，将地址设为 `https://你的图床域名/telegram/webhook`，只订阅 `message`，并使用密钥验证请求。`max_connections=1` 用于减少 KV 最终一致性与并发重试造成的重复导入。脚本保留排队消息，不清空历史待处理更新。

一个 Bot 同一时间只能使用一个 Webhook；注册后会替换该 Bot 原有的 Webhook，也不能同时使用 `getUpdates` 轮询。如果该 Bot 已用于其他自动回复服务，应先整合消息处理，或为图床创建专用 Bot 与渠道。

## 3. 验证

1. 用白名单账号私聊该 Bot，发送 `/start`，应收到操作提示和自己的数字 ID。
2. 发送一张小图片，应收到图床链接；存储频道出现对应文件。
3. 打开管理后台，在 `Telegram` 目录（或自定义目录）中确认文件，并打开回复链接验证可读取。
4. 发送原图文件，确认文件名、文件类型与大小正确。
5. 未授权账号、群组、频道消息与编辑消息都不会入库；网页原有上传入口仍然可用。

## 限制与故障处理

- Bot 私聊导入仅支持不超过 20 MB 的文件，这是当前 Telegram 云端 Bot API `getFile` 的下载限制。较大文件请走网页上传及原有分片流程。
- 仅导入启用后收到的私聊消息；不会扫描历史频道或私聊记录。相册以独立文件保存，不保留 Telegram 相册分组。
- 重复投递使用相同文件记录；索引写入失败会让 Telegram 重试，并从已有记录继续。KV 最终一致性、进程中断及外部 API/数据库无法共用事务，因此极端情况下仍可能在频道产生重复副本；不承诺严格的一次性投递。
- 链接回复失败不会撤销成功上传；可从图床后台查找文件。入库失败返回 503，由 Telegram 重试；日志仅包含通用错误，不记录 Token 或消息正文。
- 图床设置的图片审查会继续执行：文件登记后，审查服务通过 `TG_UPLOAD_PUBLIC_URL` 下的 `/file/...` 地址读取内容，不会收到含 Bot Token 的 Telegram 下载地址。若开启了白名单模式等使审查服务无法匿名读取文件的设置，审查结果为 `None`。目录的公开访问与白名单规则也继续适用。文件登记的上传来源为 Telegram Bot，不把 Telegram 服务器 IP 当成用户 IP。
- 不要随意改名或删除该 Telegram 存储渠道，以免已有文件无法解析凭据。
- 接收地址必须能被 Telegram 访问；Cloudflare Access 登录、WAF 验证页或防机器人挑战阻挡此地址时，需要为该路径配置合适规则，入口仍验证 Webhook 密钥和用户白名单。
- 停用时先调用 Telegram `deleteWebhook`，再删除 `TG_WEBHOOK_SECRET` 并重新部署。停用不会删除已经入库的文件。

## 开发验证

```sh
node --test tests/telegram-webhook.test.mjs
npx wrangler pages functions build functions --outdir .wrangler/telegram-build
```

接口依据：[Telegram setWebhook](https://core.telegram.org/bots/api#setwebhook)、[copyMessage](https://core.telegram.org/bots/api#copymessage)、[getFile](https://core.telegram.org/bots/api#getfile)。
