<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="readme/banner.png" /></a>
    <p><em>🗂️ 支持 Docker 与 Serverless 部署的开源文件托管方案，兼容多种存储后端，并提供 RESTful API 与 WebDAV 支持。</em></p>
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


# 1. 💡 项目介绍

CloudFlare ImgBed 是一个同时支持 Docker 与 Serverless 部署、可接入多种后端存储渠道的开源文件托管解决方案。

支持的存储渠道包括 **Telegram**、**Discord**、**Cloudflare R2**、**S3 兼容存储**、**Hugging Face**、**WebDAV** 等。

它不仅具备**上传**、**管理**、**读取**、**删除**等覆盖文件全生命周期的基础功能，还提供**身份认证**、**目录组织**、**内容审核**、**随机图**等能力，以及完整的 RESTful API 与 WebDAV 支持，适用于自建图床、静态站资源管理和轻量文件分发场景。详见[功能文档](https://cfbed.sanyue.de/guide/features.html)。

![CloudFlare](readme/海报.png)

# 2. 🖥️ 在线演示

**演示站点**：[CloudFlare ImgBed](https://cfbed.1314883.xyz/) · **访问密码**：`cfbed`

![文件上传页面](readme/upload.png)

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

# 3. 📚 文档与更新

## 📖 项目文档

项目文档涵盖部署方式、存储渠道配置、功能使用、RESTful API、WebDAV、版本升级及常见问题等内容。无论是首次部署还是日常维护，都可以在文档中找到对应的操作说明。

**[查看完整文档 →](https://cfbed.sanyue.de)**

## 📝 更新日志

了解项目的最新功能、问题修复、兼容性变更和升级注意事项。

[![更新日志](https://recent-update.cfbed.sanyue.de/cn)](https://cfbed.sanyue.de/guide/update-log.html)

# 4. 🌱 项目生态

欢迎前往 [CloudFlare ImgBed 生态](https://cfbed.sanyue.de/about/ecosystem.html)，探索社区提供的扩展、应用和教程，包括：

- **优秀的插件扩展**：浏览器扩展，Typecho、WordPress、Obsidian 等平台的集成插件，OpenList 驱动等
- **丰富的周边应用**：桌面客户端、Bot 辅助工具等
- **AI 智能体应用**：项目官方 Skill 及相关工具
- **优质的教程内容**：内容创作者分享的优质视频和图文教程

您也可以向社区分享自己的作品，提交规范请参见[生态建设征集令](https://github.com/MarSeventh/CloudFlare-ImgBed/discussions/606)，期待您的参与！

# 5. 💝 支持与合作伙伴

## ☕ 支持项目

开源项目的维护需要持续投入时间和精力。如果 CloudFlare ImgBed 对您有所帮助，欢迎支持项目持续发展。

<p align="center">
  <a href="https://afdian.com/a/marseventh"><img src="https://img.shields.io/badge/爱发电-946CE6?style=for-the-badge&logo=afdian&logoColor=white" height="36" alt="通过爱发电支持"></a>
  &nbsp;&nbsp;
  <a href="readme/weixin-reward.png"><img src="https://img.shields.io/badge/微信赞赏-07C160?style=for-the-badge&logo=wechat&logoColor=white" height="36" alt="通过微信赞赏支持"></a>
</p>

## 💖 赞助者

感谢每一位赞助者对本项目的支持！您的支持帮助项目持续维护，也为 CloudFlare ImgBed 的长期改进提供动力。

[![赞助者](https://afdian-sponsors.sanyue.de/image?columns=12)](https://afdian.com/a/marseventh)

## 🤝 合作伙伴

- **[Cloudflare](https://www.cloudflare.com/) & [EdgeOne](https://edgeone.ai/?from=github)**：提供 CDN 加速及安全防护

  <a href="https://www.cloudflare.com/"><img src="readme/cloudflare-logo.png" alt="Cloudflare Logo" height="25"></a> <a href="https://edgeone.ai/?from=github"><img src="readme/edgeone-logo.png" alt="EdgeOne Logo" height="25"></a>

- **[速维云](https://www.svyun.com/recommend/AELZ0UeMz8K11Zg7pEXC)**：提供云计算资源

- **[Linux DO](https://linux.do/)**：提供社区支持

# 6. 👥 项目社区

## 🧑‍💻 贡献者

感谢所有为项目贡献代码、文档、创意和反馈的开发者！

[![贡献者](https://contrib.rocks/image?repo=Marseventh/Cloudflare-ImgBed)](https://github.com/MarSeventh/CloudFlare-ImgBed/graphs/contributors)

## ⭐ Star 趋势

**如果这个项目对您有所帮助，欢迎点亮一个 Star ⭐，感谢您的支持！**

<a href="https://www.star-history.com/?repos=MarSeventh%2FCloudFlare-ImgBed%2CMarSeventh%2FSanyue-ImgHub&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=MarSeventh/CloudFlare-ImgBed%2CMarSeventh/Sanyue-ImgHub&type=date&theme=dark&legend=top-left&sealed_token=sAw_e7kRryMASKC9b3AqORk8leSZgKYTuCvYqOzqsyOmTse-00LgwOS4FtG75lHuCuxsyd-TPlyV3BieLloGaM-3M2AlLeQt2g1_Kczjm0UZdqnvVKRCR2J9oqdE0_XEKFMmOMLG_Loz8Bz3-JPKwiMyTjKM0LRRLm2TjGA73QSrTuOsRAqwj6F7LAVf" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=MarSeventh/CloudFlare-ImgBed%2CMarSeventh/Sanyue-ImgHub&type=date&legend=top-left&sealed_token=sAw_e7kRryMASKC9b3AqORk8leSZgKYTuCvYqOzqsyOmTse-00LgwOS4FtG75lHuCuxsyd-TPlyV3BieLloGaM-3M2AlLeQt2g1_Kczjm0UZdqnvVKRCR2J9oqdE0_XEKFMmOMLG_Loz8Bz3-JPKwiMyTjKM0LRRLm2TjGA73QSrTuOsRAqwj6F7LAVf" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=MarSeventh/CloudFlare-ImgBed%2CMarSeventh/Sanyue-ImgHub&type=date&legend=top-left&sealed_token=sAw_e7kRryMASKC9b3AqORk8leSZgKYTuCvYqOzqsyOmTse-00LgwOS4FtG75lHuCuxsyd-TPlyV3BieLloGaM-3M2AlLeQt2g1_Kczjm0UZdqnvVKRCR2J9oqdE0_XEKFMmOMLG_Loz8Bz3-JPKwiMyTjKM0LRRLm2TjGA73QSrTuOsRAqwj6F7LAVf" />
 </picture>
</a>

# 7. ⚖️ 开源协议与相关项目

## 📄 开源协议

> [!IMPORTANT]
> 本项目基于 [MIT License](LICENSE) 开源。您可以自由使用、修改和分发本项目，但须在软件的所有副本或重要部分中保留原始版权及许可声明。

## 🔗 相关开源项目

- **Web 前端**：[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)
- **桌面客户端**：[MarSeventh/satellite](https://github.com/MarSeventh/satellite)
- **上游项目**：[cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)

CloudFlare ImgBed 由 Telegraph-Image 发展而来，感谢原项目作者及所有贡献者。
