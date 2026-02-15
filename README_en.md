<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️Open-source file hosting solution, supporting Docker and serverless deployment, supporting multiple storage channels such as Telegram, Discord, Cloudflare R2, S3, Huggingface, etc., supporting WebDAV protocol and various RESTful APIs.</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">简体中文</a> | <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_en.md">English</a> | <a
        href="https://cfbed.sanyue.de/en">Official Website</a>
    </p>
    <p align="center">
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
    </p>
    <p align="center">
      <a href="https://trendshift.io/repositories/14324" target="_blank">
        <img src="https://trendshift.io/api/badge/repositories/14324" alt="GitHub Trending" height="80">
      </a>
    </p>
</div>




---

> [!IMPORTANT]
>
> **Please check the announcement for upgrade notes on version 2.0!**


<details>
    <summary>Announcement</summary>

## Pinned

1. If you encounter issues during deployment or usage, please carefully read the documentation, FAQ, and existing issues first.
2. **Note**: This repository is a remake of the [Telegraph-Image](https://github.com/cf-pages/Telegraph-Image) project. If you like this project, please support the original one as well.

## 2025.2.6 Version 2.0 Upgrade Notes

> The v2.0 version has been released, with many changes and optimizations compared to v1.0. However, the beta version may have potential instability. If you prefer stability, you may delay updating.
>
> Due to **changes in the build command**, this update requires **manual operation**. Please follow these steps:
>
> - Sync your forked repository to the latest version (ignore if already synced automatically)
> - Go to the Pages management page, enter `Settings` -> `Build`, edit the `Build configuration`, and set the `Build command` to `npm install`
> - All new version settings have been **migrated to the Admin Panel -> System Settings** interface, so generally no need to configure environment variables anymore. Settings made in the system settings interface will **override** environment variable settings. However, to ensure compatibility of images uploaded via the Telegram channel with the old version, **please keep any previously set Telegram-related environment variables!**
> - After confirming the above settings are correct, go to the Pages management page, enter `Deployments`, and `Retry` the last failed deployment.

## Notification About Switching to Telegram Channel

> Due to abuse of the telegraph image hosting, the upload channel has switched to Telegram Channel. Please **update to the latest version (see the last section of chapter 3.1 for update instructions)** and set `TG_BOT_TOKEN` and `TG_CHAT_ID` according to the deployment requirements in the documentation, otherwise upload functionality will not work.
>
> Also, the **KV database is now mandatory**; if not configured before, please configure it as per the documentation.
>
> For issues, please check section 5 FAQ first.

</details>



# 1. Introduction

Free file hosting solution with full lifecycle features including **upload**, **management**, **read**, and **delete**, supporting **authentication**, **directories**, **image moderation**, **random images**, and other features (see [Feature Docs](https://cfbed.sanyue.de/en/guide/features.html) for details).

![CloudFlare](static/readme/海报.png)

# 2. [Document](https://cfbed.sanyue.de/en)

Provides detailed deployment documentation, feature docs, development plans, update logs, FAQ, and more to help you get started quickly.

[![recent update](https://recent-update.cfbed.sanyue.de/en)](https://cfbed.sanyue.de/en/guide/update-log.html)

# 3. Demo

**Demo Address**: [CloudFlare ImgBed](https://cfbed.1314883.xyz/) Access Password: `cfbed`

![image-20250313204101984](static/readme/login.png)

![image-20250313204138886](static/readme/upload.png)

<details>
    <summary>Other page screenshots</summary>

![image-20250313204138886](static/readme/uploading.png)

![image-20250313204308225](static/readme/dashboard.png)

![image-20250314152355339](static/readme/customer-config.png)

![status-page](static/readme/status-page.png)

![public-gallery](static/readme/public-gallery.png)



</details>

# 4. Tips

- Frontend is open source, see [MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub).

- **Ecosystem**: We welcome community participation in the ecosystem construction. Feel free to submit PRs or Issues, and high-quality content can be found on the [official ecosystem page](https://cfbed.sanyue.de/en/about/ecosystem.html).

- **Sponsor**: Maintaining the project is not easy. If you like it, please support the author. Your support is the motivation to keep going~

  <a href="https://afdian.com/a/marseventh"><img width="200" src="https://pic1.afdiancdn.com/static/img/welcome/button-sponsorme.png" alt=""></a>
  
- **Sponsors**: Thanks to the following sponsors for supporting this project!

  [![sponsors](https://afdian-sponsors.sanyue.de/image?columns=12)](https://afdian.com/a/marseventh)
  
- **Contributors**: Thanks to the following contributors for their selfless contributions!

  [![Contributors](https://contrib.rocks/image?repo=Marseventh/Cloudflare-ImgBed)](https://github.com/MarSeventh/CloudFlare-ImgBed/graphs/contributors)

# 5. Star History

**If you like the project, please give a free star✨✨✨, thank you very much!**

[![Star History Chart](https://api.star-history.com/svg?repos=MarSeventh/CloudFlare-ImgBed,MarSeventh/Sanyue-ImgHub&type=Date)](https://star-history.com/#MarSeventh/CloudFlare-ImgBed&MarSeventh/Sanyue-ImgHub&Date)

# 6. Special Sponsors

- **[CloudFlare](https://www.cloudflare.com) & [EdgeOne](https://edgeone.ai/?from=github)**：Provides CDN acceleration, and security protection

  <a href="https://www.cloudflare.com"><img src="static/readme/cloudflare-logo.png" alt="Cloudflare Logo" height="25"></a> <a href="https://edgeone.ai/?from=github"><img src="/static/readme/edgeone-logo.png" alt="Tencent Logo" height="25"></a>

- **[svyun](https://www.svyun.com/recommend/AELZ0UeMz8K11Zg7pEXC)**：Provides cloud computing resources support
