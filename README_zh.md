<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="readme/banner.png" /></a>
    <p><em>🗂️开源文件托管解决方案，支持 Docker 和无服务器部署，支持 Telegram、Discord、Cloudflare R2、S3、Huggingface、WebDAV 等多种存储渠道，提供 RESTful APIs 和 WebDAV 支持</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_zh.md">简体中文</a> | <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">English</a> | <a href="https://cfbed.sanyue.de">官方网站</a>
    </p>
    <p align="center">
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/LICENSE"><img src="https://img.shields.io/github/license/MarSeventh/CloudFlare-ImgBed" alt="License" /></a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/releases"><img src="https://img.shields.io/github/release/MarSeventh/CloudFlare-ImgBed" alt="latest version" /></a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/releases"><img src="https://img.shields.io/github/downloads/MarSeventh/CloudFlare-ImgBed/total?color=%239F7AEA&logo=github" alt="Downloads" /></a>
        <a href="https://hub.docker.com/r/marseventh/cloudflare-imgbed"><img src="https://img.shields.io/docker/pulls/marseventh/cloudflare-imgbed" alt="Docker Pulls" /></a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/stargazers"><img src="https://img.shields.io/github/stars/MarSeventh/CloudFlare-ImgBed" alt="Stars" /></a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/network/members"><img src="https://img.shields.io/github/forks/MarSeventh/CloudFlare-ImgBed" alt="Forks" /></a>
        <a href="https://atomgit.com/MarSeventh/CloudFlare-ImgBed"><img src="https://atomgit.com/MarSeventh/CloudFlare-ImgBed/star/badge.svg" alt="G-star" /></a>
    </p>
    <p align="center">
        <a href="https://trendshift.io/repositories/14324" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14324" alt="GitHub Trending" width="250" /></a>
        <a href="https://hellogithub.com/repository/MarSeventh/CloudFlare-ImgBed" target="_blank"><img src="https://api.hellogithub.com/v1/widgets/recommend.svg?rid=71d65ace215945b0909d4c75c31b9fcb&claim_uid=6DsuqF4hInJWerv&theme=neutral" alt="Featured｜HelloGitHub" width="250" /></a>
    </p>
</div>






---

> [!IMPORTANT]
>
> **遇到问题请务必先查看[公告](https://github.com/MarSeventh/CloudFlare-ImgBed/discussions/categories/announcements)，重要通知和非兼容性更新内容均会在公告中说明！**


# 1. Introduction

CloudFlare-ImgBed 是一个兼容 Docker 和 Serverless 双栈部署，支持多种后端存储渠道的开源文件托管解决方案，不仅具备**上传**、**管理**、**读取**、**删除**等覆盖文件全生命周期的基础功能，还提供**身份认证**、**目录组织**、**内容审核**、**随机图**等能力以及完整的 RESTful API 与 WebDAV 支持，适合自建图床、静态站资源管理和轻量文件分发场景。详见[功能文档](https://cfbed.sanyue.de/guide/features.html)。

![CloudFlare](readme/海报.png)

# 2. [Document](https://cfbed.sanyue.de)

提供详细的部署文档、功能文档、开发计划、更新日志、常见问题解答等，帮助您快速上手。

[![更新日志](https://recent-update.cfbed.sanyue.de/cn)](https://cfbed.sanyue.de/guide/update-log.html)

# 3. Demo

**演示站点**：[CloudFlare ImgBed](https://cfbed.1314883.xyz/) 访问密码：`cfbed`

![image-20250313204101984](readme/upload.png)

<details>
    <summary>其他页面效果展示</summary>

<table>
  <tr>
    <td align="center" width="50%">
      <strong>登录页面</strong><br>
      <img src="readme/login.png" alt="登录页面" width="100%">
    </td>
    <td align="center" width="50%">
      <strong>上传进度</strong><br>
      <img src="readme/uploading.png" alt="上传进度" width="100%">
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>文件管理</strong><br>
      <img src="readme/dashboard.png" alt="文件管理" width="100%">
    </td>
    <td align="center" width="50%">
      <strong>用户管理</strong><br>
      <img src="readme/customer-config.png" alt="用户管理" width="100%">
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>状态页面</strong><br>
      <img src="readme/status-page.png" alt="状态页面" width="100%">
    </td>
    <td align="center" width="50%">
      <strong>公开画廊</strong><br>
      <img src="readme/public-gallery.png" alt="公开画廊" width="100%">
    </td>
  </tr>
</table>

</details>

# 4. Ecosystem

开源生态的发展离不开所有人的支持，欢迎大家前往[CloudFlare ImgBed 生态建设](https://cfbed.sanyue.de/about/ecosystem.html)页面了解更多信息，我们的生态建设版块包括但不限于以下内容：

- **优秀的插件扩展**：浏览器插件；Typecho、WordPress、Obsidian 等知名平台扩展插件；OpenList 驱动等
- **丰富的周边应用**：桌面客户端、bot 辅助工具等
- **AI 智能体应用**：项目官方 skill 等
- **优质的教程内容**：各大自媒体创作者的优质视频、文字教程

您不仅能在这里找到您心仪的插件、应用、教程，还可以在这里分享您自己的作品，分享请参考[生态建设征集令](https://github.com/MarSeventh/CloudFlare-ImgBed/discussions/606)的说明，期待大家积极参与到我们的生态建设中来！

# 5. Tips

- **前端开源**：参见[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)项目。

- **桌面端开源**：参见[MarSeventh/satellite](https://github.com/MarSeventh/satellite)项目。

- **赞助**：项目维护不易，喜欢本项目的话，可以作者大大一点小小的鼓励哦，您的每一份支持都是我前进的动力\~ 


  <a href="https://afdian.com/a/marseventh"><img src="https://img.shields.io/badge/AFDIAN-946CE6?style=for-the-badge&logo=afdian&logoColor=white" height="36" alt="Afdian"></a>&nbsp;&nbsp;<a href="readme/weixin-reward.png" target="_blank"><img src="https://img.shields.io/badge/WeChat_Pay-07c160?style=for-the-badge&logo=wechat&logoColor=white" height="36" alt="WeChat Pay"></a>

- **Sponsors**：感谢以下赞助者对本项目的支持！

  [![赞助者](https://afdian-sponsors.sanyue.de/image?columns=12)](https://afdian.com/a/marseventh)
  
- **Contributors**：感谢以下贡献者对本项目的无私贡献！

  [![Contributors](https://contrib.rocks/image?repo=Marseventh/Cloudflare-ImgBed)](https://github.com/MarSeventh/CloudFlare-ImgBed/graphs/contributors)

# 6. Star History

**如果觉得项目不错希望您能给个免费的 star✨✨✨，非常感谢！**

<a href="https://www.star-history.com/?repos=MarSeventh%2FCloudFlare-ImgBed%2CMarSeventh%2FSanyue-ImgHub&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=MarSeventh/CloudFlare-ImgBed%2CMarSeventh/Sanyue-ImgHub&type=date&theme=dark&legend=top-left&sealed_token=sAw_e7kRryMASKC9b3AqORk8leSZgKYTuCvYqOzqsyOmTse-00LgwOS4FtG75lHuCuxsyd-TPlyV3BieLloGaM-3M2AlLeQt2g1_Kczjm0UZdqnvVKRCR2J9oqdE0_XEKFMmOMLG_Loz8Bz3-JPKwiMyTjKM0LRRLm2TjGA73QSrTuOsRAqwj6F7LAVf" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=MarSeventh/CloudFlare-ImgBed%2CMarSeventh/Sanyue-ImgHub&type=date&legend=top-left&sealed_token=sAw_e7kRryMASKC9b3AqORk8leSZgKYTuCvYqOzqsyOmTse-00LgwOS4FtG75lHuCuxsyd-TPlyV3BieLloGaM-3M2AlLeQt2g1_Kczjm0UZdqnvVKRCR2J9oqdE0_XEKFMmOMLG_Loz8Bz3-JPKwiMyTjKM0LRRLm2TjGA73QSrTuOsRAqwj6F7LAVf" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=MarSeventh/CloudFlare-ImgBed%2CMarSeventh/Sanyue-ImgHub&type=date&legend=top-left&sealed_token=sAw_e7kRryMASKC9b3AqORk8leSZgKYTuCvYqOzqsyOmTse-00LgwOS4FtG75lHuCuxsyd-TPlyV3BieLloGaM-3M2AlLeQt2g1_Kczjm0UZdqnvVKRCR2J9oqdE0_XEKFMmOMLG_Loz8Bz3-JPKwiMyTjKM0LRRLm2TjGA73QSrTuOsRAqwj6F7LAVf" />
 </picture>
</a>

# 7. Special Sponsors

- **[CloudFlare](https://www.cloudflare.com) & [EdgeOne](https://edgeone.ai/?from=github)**：提供 CDN 加速和安全保护服务

  <a href="https://www.cloudflare.com"><img src="readme/cloudflare-logo.png" alt="Cloudflare Logo" height="25"></a> <a href="https://edgeone.ai/?from=github"><img src="readme/edgeone-logo.png" alt="Tencent Logo" height="25"></a>

- **[速维云](https://www.svyun.com/recommend/AELZ0UeMz8K11Zg7pEXC)**：提供云计算服务资源支持

- **[Linux DO](https://linux.do/)**：新的理想型社区

# 8. License

本项目基于 [MIT 协议](https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/LICENSE) 开源，您在符合协议的前提下可以自由使用、修改、分发本项目，但请保留原作者在**包括但不限于**前后端代码和其他文件在内的所有副本或重要部分中的**版权声明**。

本项目基于 [Telegraph-Image](https://github.com/cf-pages/Telegraph-Image) 项目二次开发。
