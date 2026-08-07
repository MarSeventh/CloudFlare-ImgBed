<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="readme/banner.png" /></a>
    <p><em>🗂️ Beyond image hosting: an all-in-one, open-source file management hub.</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_zh.md">简体中文</a> | <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">English</a> | <a href="https://cfbed.sanyue.de/en">Official Website</a>
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
> **If you encounter issues, please check the [announcement](https://github.com/MarSeventh/CloudFlare-ImgBed/discussions/categories/announcements) first. Important notifications and non-compatible updates will be explained in the announcement!**


# 1. 💡 Introduction

CloudFlare ImgBed is a self-hosted image and file hosting solution for Docker and serverless environments, bringing **Telegram**, **Discord**, **Cloudflare R2**, **S3-compatible storage**, **Hugging Face**, **WebDAV**, and more into one management interface. It provides file management, authentication, directory organization, content moderation, a RESTful API, and WebDAV for personal image hosting, website asset management, and lightweight file distribution. **[View all features →](https://cfbed.sanyue.de/en/guide/features.html)**

![CloudFlare](readme/海报.png)

## 🤝 Partners

<table width="100%">
  <tr>
    <td align="center" width="20%">
      <strong><a href="https://www.cloudflare.com/">Cloudflare</a></strong>
    </td>
    <td align="center" width="20%">
      <strong><a href="https://edgeone.ai/?from=github">EdgeOne</a></strong>
    </td>
    <td align="center" width="20%">
      <strong><a href="https://www.hncloud.com/activity/activity_2026summer.html?k=MarSeventh">HuaNa Cloud</a></strong>
    </td>
    <td align="center" width="20%">
      <strong><a href="https://www.svyun.com/recommend/AELZ0UeMz8K11Zg7pEXC">SuWei Cloud</a></strong>
    </td>
    <td align="center" width="20%">
      <strong><a href="https://linux.do/t/topic/2578561">Linux DO</a></strong>
    </td>
  </tr>
  <tr>
    <td align="center"><a href="https://www.cloudflare.com/"><img src="readme/cloudflare-logo.png" alt="Cloudflare logo" height="25"></a></td>
    <td align="center"><a href="https://edgeone.ai/?from=github"><img src="readme/edgeone-logo.png" alt="EdgeOne logo" height="25"></a></td>
    <td align="center"><a href="https://www.hncloud.com/activity/activity_2026summer.html?k=MarSeventh"><img src="readme/hncloud-logo.png" alt="HuaNa Cloud logo" height="25"></a></td>
    <td align="center"><a href="https://www.svyun.com/recommend/AELZ0UeMz8K11Zg7pEXC"><img src="readme/svyun-logo.png" alt="SuWei Cloud logo" height="25"></a></td>
    <td align="center"><a href="https://linux.do/t/topic/2578561"><img src="readme/linuxdo-logo.png" alt="Linux DO logo" height="25"></a></td>
  </tr>
  <tr>
    <td align="center"><sub>Provides CDN acceleration and security protection</sub></td>
    <td align="center"><sub>Provides CDN acceleration and security protection</sub></td>
    <td align="center"><sub>Provides stable and high-quality cloud computing resources</sub></td>
    <td align="center"><sub>Provides stable and high-quality cloud computing resources</sub></td>
    <td align="center"><sub>Provides community support</sub></td>
  </tr>
</table>

# 2. 🖥️ Demo

**Demo Address**: [CloudFlare ImgBed](https://cfbed.1314883.xyz/) · **Access Password**: `cfbed`

![Upload Page](readme/upload.png)

<details>
    <summary>Other page screenshots</summary>

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Login Page</strong><br>
      <img src="readme/login.png" alt="Login Page" width="100%">
    </td>
    <td align="center" width="50%">
      <strong>Upload Progress</strong><br>
      <img src="readme/uploading.png" alt="Upload Progress" width="100%">
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>File Management</strong><br>
      <img src="readme/dashboard.png" alt="File Management" width="100%">
    </td>
    <td align="center" width="50%">
      <strong>User Management</strong><br>
      <img src="readme/customer-config.png" alt="User Management" width="100%">
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>Status Page</strong><br>
      <img src="readme/status-page.png" alt="Status Page" width="100%">
    </td>
    <td align="center" width="50%">
      <strong>Public Gallery</strong><br>
      <img src="readme/public-gallery.png" alt="Public Gallery" width="100%">
    </td>
  </tr>
</table>

</details>

# 3. 📚 Documentation & Updates

## 📖 Documentation

The documentation covers deployment, storage configuration, feature usage, RESTful API integration, WebDAV, version upgrades, and troubleshooting. Whether you are deploying the project for the first time or maintaining an existing instance, you can find the relevant instructions here.

**[Read the full documentation →](https://cfbed.sanyue.de/en)**

## 📝 Changelog

Follow the latest features, bug fixes, compatibility changes, and upgrade notes.

[![Recent Updates](https://recent-update.cfbed.sanyue.de/en)](https://cfbed.sanyue.de/en/guide/update-log.html)

# 4. 🌱 Ecosystem

An open-source ecosystem grows through community support. Visit the [CloudFlare ImgBed Ecosystem](https://cfbed.sanyue.de/en/about/ecosystem.html) page to explore the following resources and more:

- **Plugin Extensions**: Browser extensions, integrations for Typecho, WordPress, and Obsidian, OpenList drivers, and more.
- **Companion Applications**: Desktop clients, bot tools, and more.
- **AI Agent Applications**: Official project skills and related tools.
- **Tutorials and Guides**: High-quality videos and articles from content creators.

Discover useful plugins, applications, and tutorials, or share your own work with the community. See the [Ecosystem Call for Contributions](https://github.com/MarSeventh/CloudFlare-ImgBed/discussions/606) for submission guidelines. We look forward to your participation!

# 5. 💝 Support & Sponsors

## ☕ Support the Project

Maintaining an open source project takes time and effort. If CloudFlare ImgBed has helped you, consider supporting its continued development.

<p align="center">
  <a href="https://afdian.com/a/marseventh"><img src="https://img.shields.io/badge/AFDIAN-946CE6?style=for-the-badge&logo=afdian&logoColor=white" height="36" alt="Support via Afdian"></a>
  &nbsp;&nbsp;
  <a href="readme/weixin-reward.png"><img src="https://img.shields.io/badge/WeChat_Pay-07C160?style=for-the-badge&logo=wechat&logoColor=white" height="36" alt="Support via WeChat Pay"></a>
</p>

## 💖 Sponsors

Thank you to every sponsor who supports this project! Your support helps sustain ongoing maintenance and drives the continued improvement of CloudFlare ImgBed.

[![Sponsors](https://afdian-sponsors.sanyue.de/image?columns=12)](https://afdian.com/a/marseventh)

# 6. 👥 Community

## 🧑‍💻 Contributors

Thank you to everyone who has contributed code, documentation, ideas, and feedback!

[![Contributors](https://contrib.rocks/image?repo=Marseventh/Cloudflare-ImgBed)](https://github.com/MarSeventh/CloudFlare-ImgBed/graphs/contributors)

## ⭐ Star History

**If you find the project useful, please consider giving it a Star ⭐. Thank you for your support!**

<a href="https://github.com/MarSeventh/CloudFlare-ImgBed">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://marseventh.github.io/CloudFlare-ImgBed/star-history-dark.svg" />
   <source media="(prefers-color-scheme: light)" srcset="https://marseventh.github.io/CloudFlare-ImgBed/star-history-light.svg" />
   <img alt="Star-History" src="https://marseventh.github.io/CloudFlare-ImgBed/star-history-light.svg" />
 </picture>
</a>

# 7. ⚖️ License & Related Projects

## 📄 License

> [!IMPORTANT]
> This project is licensed under the [MIT License](LICENSE). You may use, modify, and distribute it, provided that the original copyright and license notices are retained in all copies or substantial portions of the software.

## 🔗 Related Open Source Projects

- **Web frontend**: [MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)
- **Desktop client**: [MarSeventh/satellite](https://github.com/MarSeventh/satellite)
- **Upstream project**: [cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)

CloudFlare ImgBed evolved from Telegraph-Image. Thanks to its original authors and contributors.
