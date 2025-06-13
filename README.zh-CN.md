<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️开源文件托管解决方案，基于 Cloudflare Pages，支持 Telegram Bot 、 Cloudflare R2 ，S3 等多种存储渠道</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">简体中文</a>|<a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_en.md">English</a>
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

2. **前端仓库**：[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)

3. **注意**：本仓库为[Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)项目的重制版，如果你觉得本项目不错，在支持本项目的同时，也请支持原项目。

## 2025.2.6  V2.0 版本升级注意事项

> v2.0 beta 版已发布，相较于 v1.0 版本进行了大量改动和优化，但 beta 版本可能存在潜在不稳定性，若您追求稳定，可选择暂缓更新。
>
> 由于**构建命令发生了变化**，此次更新需要您**手动进行**，请按照以下步骤进行操作：
>
> - 同步fork的仓库至最新版（若已自动同步可忽略）
>
> - 前往 pages 管理页面，进入`设置`->`构建`，编辑`构建配置`，在`构建命令`处填写`npm install`
>
>   ![image-20250212190315179](static/readme/202502121903327.png)
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

<details>
    <summary>生态建设</summary>



## 1. 插件

- **编辑器内自动上传（油猴脚本）**：https://greasyfork.org/zh-CN/scripts/529816-image-uploader-to-markdown-to-cloudflare-imgbed （_作者：Linux.do: [calg_c](https://linux.do/u/calg_c/summary)_）

## 2.仓库

- **向TG BOT发送文件上传图床**：[uki0xc/img-up-bot: 使用telegram机器人链接图床进行上传](https://github.com/uki0xc/img-up-bot?tab=readme-ov-file) （_作者：[uki0xc](https://github.com/uki0xc)_)



</details>

<details>
    <summary>体验地址及优质博文、视频（搭建或使用有问题可以先去里面学习哦~）</summary>


**体验地址**：[CloudFlare ImgBed](https://cfbed.1314883.xyz/)

> 访问码：cfbed

**体验视频**：[CloudFlare免费图床，轻松守护你的每一份精彩！_哔哩哔哩_bilibili](https://www.bilibili.com/video/BV1y3WGe4EGh/?vd_source=da5ecbe595e41089cd1bed95932b8bfd)

**相关教程视频**：

- [利用Cloudflare R2 +Pages搭建在线图床系统，不限空间，不被墙，超级简单，完全免费 (youtube.com)](https://www.youtube.com/watch?v=T8VayuUMOzM)

**相关优质博文（感谢每一位鼎力支持的热心大佬）：**

- [CloudFlare-ImgBed项目 – yunsen2025的小窝](https://www.yunsen2025.top/category/cloudflare-imgbed/)
  - [完全免费，图文教程手把手教你使用cloudflare搭建一个无限空间的私人图床 支持身份认证与成人元素鉴定！ - yunsen2025的小窝](https://www.yunsen2025.top/blog-cfpages-syq-imgbed)
  - [为CloudFlare-ImgBed图床配置国内CDN并分线路解析，以最低成本享受极致速度！ – yunsen2025的小窝](https://www.yunsen2025.top/cloudflare-imgbed-fen-xian-pei-zhi-guo-nei-cdn/)
- [利用cloudflare pages搭建telegram频道图床 (lepidus.me)](https://blogstr.lepidus.me/post/1725801323700/)
- [搭建基于CloudFlare和Telegram的免费图床教程 - 刘学馆 | Blog (sexy0769.com)](https://blog.sexy0769.com/skill/735.html)
- [CloudFlare+Github，打造属于自己的免费图床 - 大头钉的小小blog (luckyting.top)](https://luckyting.top/index.php/archives/20/)

</details>



## 最近更新

Add Features:

- 美化报错图片
- 上传页面支持预览ico等更多格式文件



<details>
    <summary>更新日志</summary>


## 2025.6.13

Add Features:

- 美化报错图片
- 上传页面支持预览ico等更多格式文件

## 2025.6.12

Add Features:

- `upload`接口支持跨域访问和调用

Fix Bugs:

- 修复`list`接口返回数据完整性的问题

## 2025.5.23

Add Features:

- 增加公告功能

Fix Bugs:

- 修复后台图片名过长遮盖图片的问题
- 优化部分页面显示效果
- 修复 Docker 镜像无法访问 https 外链的问题

## 2025.5.11

Add Features:

- 支持通过Docker在服务器上部署

## 2025.3.14

Add Features:

- 上传用户管理支持显示IP具体位置

## 2025.3.8

Add Features:

- 随机图API支持按目录读取，支持按目录进行权限控制

Fix Bugs:

- 修复随机图API的缓存问题

## 2025.3.7

Add Features:

- **目录功能上线啦**，当前支持：
  - 上传到指定目录
  - 整目录删除
  - 文件位置移动（ Telegraph 和旧版 Telegram 渠道不支持移动）
  - 按目录读取文件
- 随机图API支持按目录读取

Fix Bugs:

- 修复多项影响体验的bug

## 2025.3.1

Add Features:

- 支持粘贴多个链接同时上传
- 支持存储和管理外链

Fix Bugs:

- 修复管理端复制 S3 链接的有关问题
- 修复管理端部分页面设置不生效的问题
- 修复渠道设置某些情况下不能保存的问题

## 2025.2.6

**v2.0版本焕新登场**，带来多项新功能和优化，给您焕然一新的用户体验：

💪**更强大**：

- 接入 S3 API 渠道，支持 Cloudflare R2 , Backblaze B2 ，七牛云，又拍云等多个服务商的对象存储服务
- 支持设置多个 Telegram 和 S3 渠道，支持多渠道负载均衡
- 上传文件支持短链接命名方式

✈️**更高效**：

- 全部设置项迁移到管理端系统设置界面，无需进行环境变量的繁琐配置，立即设置立即生效
- 管理端 Gallery 和 用户管理 等页面实现分页读取，提升前端渲染速度，优化使用体验
- 支持禁用、启用渠道，渠道管理自在掌握
- 多个设置项加入提示弹窗，不用到处翻阅文档，设置更踏实

✨**更精致**：

- 全局支持深色模式，根据用户喜好和时间自动切换，凸显满满高级感
- 登陆页面、图库页面、用户管理页面等多个页面细节重新打磨，操作更直观
- 上传页全新 Tab 栏，一拉一合，灵动又便捷
- Logo 焕新，纯手工打造，能力有限，不喜勿喷（
- 支持自定义隐藏页脚，强迫症患者有救啦

## 2024.12.27

Add Features:

- 支持通过环境变量自定义全局默认链接前缀（见3.1.3.6自定义配置接口）
- 管理端支持自定义链接前缀
- 管理端部分页面展示效果优化
- `/upload`API支持返回完整链接（请求时设置`returnFormat`参数，详见API文档）

Fix Bugs:

- 优化上传页面显示效果

## 2024.12.20

Add Features:

- 管理端支持拉黑上传IP（Dashboard->用户管理->允许上传）
- 管理端批量操作支持按照用户选择的顺序进行（[#issue124](https://github.com/MarSeventh/CloudFlare-ImgBed/issues/124)）
- `random`接口优化，减少KV操作次数，增加`content`参数，支持返回指定类型的文件
- 接入CloudFlare Cache API，提升 list 相关接口访问速度
- 正常读取返回图片的CDN缓存时间从1年调整为7天，防止缓存清除不成功的情况下图片长时间内仍可以访问的问题

## 2024.12.14

Add Features:

- 管理端增加批量黑名单、白名单功能

## 2024.12.13

Add Features:

- 优化blockimg、whitelistmode、404等返回状态的缓存策略，尽可能减少回源请求(参考文档`3.1.3.9管理端删除、拉黑等操作优化`进行设置)

## 2024.12.12

Add Features: 

- 后端支持上传失败自动切换其他渠道重试
- 优化404、blockimg、whitelistmode等返回状态的显示样式

## 2024.12.11

Add Features:

- 进行删除、加入白名单、加入黑名单等操作时，自动清除CF CDN缓存，避免延迟生效(参考文档`3.1.3.9管理端删除、拉黑等操作优化`进行设置)

## 2024.12.10

Add Features:

- 文件详情增加文件大小记录

## 2024.12.09

Add Features:

- 开放更多文件格式

Fix Bugs:

- 读取文件响应头增加允许跨域头`access-control-allow-origin: *`

## 2024.12.04

Add Features:

- 支持自定义命名方式（仅原名 or 仅随机前缀 or 默认的随机前缀_原名）
- Telegram Channel渠道上传文件记录机器人和频道数据，便于迁移和备份
- 支持自定义链接前缀

Fix Bugs:

- R2渠道在管理端删除时，存储桶同步删除

## 2024.11.05

Add Features:

- 增加对R2 bucket的支持

## 2024.10.20

Add Features:

- 页脚增加自定义传送门功能

## 2024.09.28

Add Features:

- 上传页面右下角工具栏样式重构，支持上传页自定义压缩（上传前+存储端）
- 增加仅删除上传成功图片、上传失败图片重试

## 2024.09.27

Add Features:

- 上传页面点击链接时，自动复制到剪切板
- 上传设置记忆（上传方式、链接格式等）

Fix Bugs:

- 若未设置密码，无需跳转登录页

## 2024.09.26

Add Features:

- 优化粘贴上传时的文件命名方法

## 2024.09.12

Add Features:

- 增加背景透明度支持自定义

## 2024.09.11

Add Features:

- 支持背景切换时间自定义

## 2024.08.26

Add Features:

- 支持大于5MB的图片上传前自动压缩
- 图床名称和Logo支持自定义
- 网站标题和Icon支持自定义

## 2024.08.23

Add Features:

- 支持URL粘贴上传

## 2024.08.21

Add Features:

- 完善多格式链接展示形式，增加UBB格式链接支持
- 完善登录逻辑，后端增加认证码校验接口

## 2024.07.25

Add Features:

- 增加随机图API

Fix Bugs:

- 修复API上传无法直接展示在后台的问题

## 2024.07.22

Add Features:

- 增加粘贴图片上传功能

## 2024.07.21

Add Features:

- 增加Markdown、HTML等格式链接复制功能
- 上传页面增加管理端入口

</details>

# 1.Introduction

免费文件托管解决方案，具有**上传**、**管理**、**读取**、**删除**等全链路功能，覆盖文件全生命周期，支持**鉴权**、**目录**、**图片审查**、**随机图**等各项特性。

![CloudFlare](static/readme/海报.png)

# 2.Features

<details>
    <summary>项目特性</summary>

- **开源**
  
  - 前端开源（可自行修改、打包使用）
  
- **炫酷的动效（**
  
  - 流畅丝滑的过渡动画~
  - 上传文件实现呼吸灯效果
  - 灵动的操作体验
  
- **人性化上传**
  
  - **覆盖大多数文件格式**：支持绝大多数常见**图片、视频、动图**等，同时也支持其他大多数格式的文件
  
  - **支持多种存储渠道**：支持 **Telegram Bot**, **Cloudflare R2**, **S3**  等多种存储渠道一键切换
  
    > Telegram Bot渠道：上传文件大小限制为20MB，提供客户端和服务端压缩功能
    >
    > Cloudflare R2渠道：上传大小不限，但超过免费额度会扣费，详见[Pricing | Cloudflare R2 docs](https://developers.cloudflare.com/r2/pricing/)
    >
    > ![](static/readme/202411052346701.png)
  
  - **上传方式多样**：支持多种上传方式（**拖拽点击、粘贴**）（Web/API)
  
    > 1. 粘贴上传支持**文件**和**URL**
    > 2. 支持批量上传（不限同时选择文件数量，但为了保证稳定性，同时处于上传状态的文件最多为10个）
    > 3. 上传显示实时上传进度
    > 4. Web和API端上传图片，均可直接展示在管理页面中
    > 5. 过大图片在前端进行压缩，提升上传稳定性和加载性能;支持自定义压缩质量，自定义