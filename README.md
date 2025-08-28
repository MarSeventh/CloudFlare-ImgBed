<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️开源文件托管解决方案，支持 Docker 和无服务器部署，支持 Telegram Bot 、 Cloudflare R2 、S3 等多种存储渠道</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">简体中文</a> | <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_en.md">English</a> | <a href="https://cfbed.sanyue.de">官方网站</a>
    </p>
    <div>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/LICENSE">
        <img src="https://img.shields.io/github/license/MarSeventh/CloudFlare-ImgBed" alt="License" />
        </a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/releases">
        <img src="https://img.shields.io/github/release/MarSeventh/CloudFlare-ImgBed" alt="latest version" />
        </a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/releases">
        <img src="https://img.shields.io/github/downloads/MarSeventh/CloudFlare-ImgBed/total?color=%239F7AEA&logo=github" alt="Downloads" />
        </a>
        <a href="https://hub.docker.com/r/marseventh/cloudflare-imgbed">
  		  <img src="https://img.shields.io/docker/pulls/marseventh/cloudflare-imgbed?style=flat-square" alt="Docker Pulls" />
		</a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/issues">
          <img src="https://img.shields.io/github/issues/MarSeventh/CloudFlare-ImgBed" alt="Issues" />
        </a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/stargazers">
          <img src="https://img.shields.io/github/stars/MarSeventh/CloudFlare-ImgBed" alt="Stars" />
        </a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/network/members">
          <img src="https://img.shields.io/github/forks/MarSeventh/CloudFlare-ImgBed" alt="Forks" />
        </a>
    </div>
</div>





---

> [!IMPORTANT]
>
> **v2.0 版本升级注意事项请查看公告！**



<details>
    <summary>公告</summary>



## 置顶

1. 部署使用出现问题，请先仔细查阅文档、常见问题解答以及已有issues。

2. **注意**：本仓库为[Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)项目的重制版，如果你觉得本项目不错，在支持本项目的同时，也请支持原项目。

## 2025.2.6  V2.0 版本升级注意事项

> v2.0 版已发布，相较于 v1.0 版本进行了大量改动和优化，但 beta 版本可能存在潜在不稳定性，若您追求稳定，可选择暂缓更新。
>
> 由于**构建命令发生了变化**，此次更新需要您**手动进行**，请按照以下步骤进行操作：
>
> - 同步fork的仓库至最新版（若已自动同步可忽略）
>
> - 前往 pages 管理页面，进入`设置`->`构建`，编辑`构建配置`，在`构建命令`处填写`npm install`
>
> - 新版本所有设置项已**迁移至 管理端->系统设置 界面**，原则上无需再通过环境变量的方式进行设置，通过系统设置界面进行的设置将**覆盖掉**环境变量中的设置，但为了保证 **Telegram渠道的图片** 能够与旧版本相兼容，**若您之前设置了 Telegram 渠道相关的环境变量，请将其保留！**
>
> - 确保上述设置完成无误后，前往 pages 管理页面，进入`部署`，对最后一次不成功的部署进行`重试操作`

## 关于切换到 Telegram 渠道的通知


> 由于telegraph图床被滥用，该项目上传渠道已切换至Telegram Channel，请**更新至最新版（更新方式见第3.1章最后一节）**，按照文档中的部署要求**设置`TG_BOT_TOKEN`和`TG_CHAT_ID`**，否则将无法正常使用上传功能。
>
> 此外，目前**KV数据库为必须配置**，如果以前未配置请按照文档说明配置。
>
> 出现问题，请先查看第5节常见问题Q&A部分。

</details>




# 1. Introduction

免费文件托管解决方案，具有**上传**、**管理**、**读取**、**删除**等全链路功能，覆盖文件全生命周期，支持**鉴权**、**目录**、**图片审查**、**随机图**等各项特性（详见[功能文档](https://cfbed.sanyue.de/guide/features.html)）。

![CloudFlare](static/readme/海报.png)

# 2. [Document](https://cfbed.sanyue.de)

提供详细的部署文档、功能文档、开发计划、更新日志、常见问题解答等，帮助您快速上手。

[![更新日志](https://recent-update.cfbed.sanyue.de/cn)](https://cfbed.sanyue.de/guide/update-log.html)

# 3. Demo

**演示站点**：[CloudFlare ImgBed](https://cfbed.1314883.xyz/) 访问密码：`cfbed`

![image-20250313204101984](static/readme/202503132041511.png)

![image-20250313204138886](static/readme/202503132041072.png)

<details>
    <summary>其他页面效果展示</summary>

![image-20250313204308225](static/readme/202503132043466.png)

![image-20250314152355339](static/readme/202503141524797.png)

![status-page](static/readme/status-page.png)

![image-20250313204325002](static/readme/202503132043265.png)



</details>


# 4. WebDAV Bridge 桥接服务

本项目提供了一个强大的 **WebDAV Bridge Cloudflare Worker**，让您可以通过标准的 WebDAV 协议访问和管理托管的文件。

## 4.1 功能特性

- 🔒 **身份验证**：支持基于用户名密码的 Basic Auth 认证
- 📁 **目录浏览**：完整的目录结构展示，支持 HTML 页面和 WebDAV 客户端
- 📤 **文件上传**：通过 PUT 方法上传文件到指定目录
- 🗑️ **文件删除**：支持删除单个文件或整个文件夹
- 📥 **文件下载**：直接下载文件，自动代理到上游存储
- 🌐 **跨域支持**：内置 CORS 支持，确保 Web 客户端正常访问

## 4.2 支持的 WebDAV 方法

| 方法 | 功能 | 说明 |
|------|------|------|
| `PROPFIND` | 列出目录内容 | 获取文件和文件夹列表，支持 WebDAV 客户端 |
| `GET` | 下载文件/浏览目录 | 文件下载或 HTML 目录浏览页面 |
| `PUT` | 上传文件 | 上传文件到指定路径和文件夹 |
| `DELETE` | 删除文件/文件夹 | 支持删除单个文件或整个目录 |
| `OPTIONS` | 协议探测 | 返回支持的 WebDAV 方法和功能 |
| `MKCOL` | 创建目录 | 创建新的文件夹（自动支持） |

## 4.3 部署配置

### 4.3.1 环境变量设置

需要在 Cloudflare Worker 中设置以下环境变量：

```bash
# WebDAV 认证凭据
AUTH_USER=your_username          # WebDAV 登录用户名
AUTH_PASS=your_password          # WebDAV 登录密码

# 上游 API 配置
UPSTREAM_HOST=your-imgbed.domain.com  # 您的图床域名
API_TOKEN=your_api_token         # API 访问令牌
```

### 4.3.2 自定义域名绑定（推荐）

为了获得更好的使用体验，强烈建议为 WebDAV Worker 绑定自定义域名：

1. **准备域名**：确保您有一个可用的域名，并且该域名已托管在 Cloudflare
2. **添加自定义路由**：
   - 进入 Cloudflare Workers 控制台
   - 选择您的 WebDAV Worker
   - 点击 `触发器` (Triggers) 标签
   - 点击 `添加自定义域名`
   - 输入您的子域名，如：`webdav.yourdomain.com`
   - 点击 `添加域名`

3. **SSL 证书**：Cloudflare 会自动为您的自定义域名提供免费 SSL 证书

**使用自定义域名的优势**：
- 🌟 **更好的兼容性**：避免某些 WebDAV 客户端对 `.workers.dev` 域名的限制
- 🔒 **更高的安全性**：自定义域名通常更受客户端信任
- 📱 **移动端友好**：iOS/Android 设备对自定义域名支持更好
- 🎯 **品牌一致性**：与您的图床服务使用统一的域名体系

## 4.4 使用方式

### 浏览器访问
直接在浏览器中访问 Worker 地址，输入认证信息后可以浏览文件目录：
```
# 使用自定义域名（推荐）
https://webdav.yourdomain.com/

# 或使用默认 Worker 域名
https://your-webdav-worker.your-subdomain.workers.dev/
```

### WebDAV 客户端
可以使用任何支持 WebDAV 的客户端连接：

**Windows 资源管理器**：
1. 打开"此电脑"
2. 右键选择"添加网络位置"
3. 输入 WebDAV Worker 地址
4. 输入用户名和密码

**macOS Finder**：
1. 在 Finder 中按 `Cmd+K`
2. 输入 WebDAV 地址（推荐使用自定义域名）：
   - `https://webdav.yourdomain.com` 或
   - `https://your-webdav-worker.your-subdomain.workers.dev`
3. 输入认证信息

**第三方客户端**：
- Cyberduck、WinSCP、FileZilla Pro 等文件管理器
- Mobile 端：FE File Explorer、Documents by Readdle 等

## 4.5 特色功能

- **智能路径处理**：自动处理文件路径，支持中文和特殊字符
- **分页加载**：大目录自动分页加载，提升性能
- **错误处理**：完善的错误处理和用户友好的错误信息
- **缓存优化**：合理利用浏览器缓存，提升访问速度
- **安全可靠**：基于 Cloudflare Worker 的边缘计算，全球加速

通过 WebDAV Bridge，您可以像使用本地文件夹一样管理托管的文件，实现了真正的"云端硬盘"体验！

# 5. Tips

- **前端开源**：参见[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)项目。

- **生态建设**：欢迎社区参与生态建设，欢迎提交 PR 或者 Issue，优质内容参见[官网生态建设页面](https://cfbed.sanyue.de/about/ecosystem.html)。

- **赞助**：项目维护不易，喜欢本项目的话，可以作者大大一点小小的鼓励哦，您的每一份支持都是我前进的动力\~ 

  <a href="https://afdian.com/a/marseventh"><img width="200" src="https://pic1.afdiancdn.com/static/img/welcome/button-sponsorme.png" alt=""></a>
  
- **Sponsors**：感谢以下赞助者对本项目的支持！

  [![赞助者](https://afdian-sponsors.sanyue.de/image)](https://afdian.com/a/marseventh)
  
- **Contributors**：感谢以下贡献者对本项目的无私贡献！

  [![Contributors](https://contrib.rocks/image?repo=Marseventh/Cloudflare-ImgBed)](https://github.com/MarSeventh/CloudFlare-ImgBed/graphs/contributors)

# 5. Star History

**如果觉得项目不错希望您能给个免费的star✨✨✨，非常感谢！**

[![Star History Chart](https://api.star-history.com/svg?repos=MarSeventh/CloudFlare-ImgBed,MarSeventh/Sanyue-ImgHub&type=Date)](https://star-history.com/#MarSeventh/CloudFlare-ImgBed&MarSeventh/Sanyue-ImgHub&Date)

# 6. Special Sponsors

- **[CloudFlare](https://www.cloudflare.com) & [EdgeOne](https://edgeone.ai/?from=github)**：提供CDN加速和安全保护服务

  <a href="https://www.cloudflare.com"><img src="static/readme/cloudflare-logo.png" alt="Cloudflare Logo" height="25"></a> <a href="https://edgeone.ai/?from=github"><img src="https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png" alt="Tencent Logo" height="25"></a>

- **[亚洲云](https://www.asiayun.com) & [DartNode](https://dartnode.com)**：提供云计算服务资源支持

  [![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")

