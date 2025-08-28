<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️Open-source file hosting solution, supporting Docker and serverless deployment, supporting multiple storage channels such as Telegram Bot, Cloudflare R2, S3, etc.</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">简体中文</a> | <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_en.md">English</a> | <a
        href="https://cfbed.sanyue.de/en">Official Website</a>
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

![image-20250313204101984](static/readme/202503132041511.png)

![image-20250313204138886](static/readme/202503132041072.png)

<details>
    <summary>Other page screenshots</summary>

![image-20250313204308225](static/readme/202503132043466.png)

![image-20250314152355339](static/readme/202503141524797.png)

![status-page](static/readme/status-page.png)

![image-20250313204325002](static/readme/202503132043265.png)

</details>

# 4. WebDAV Bridge Service

This project provides a powerful **WebDAV Bridge Cloudflare Worker** that allows you to access and manage hosted files through the standard WebDAV protocol.

## 4.1 Features

- 🔒 **Authentication**: Supports Basic Auth authentication with username/password
- 📁 **Directory Browsing**: Complete directory structure display, supports both HTML pages and WebDAV clients
- 📤 **File Upload**: Upload files to specified directories using PUT method
- 🗑️ **File Deletion**: Support for deleting individual files or entire folders
- 📥 **File Download**: Direct file downloads with automatic proxy to upstream storage
- 🌐 **CORS Support**: Built-in CORS support ensuring proper web client access

## 4.2 Supported WebDAV Methods

| Method | Function | Description |
|--------|----------|-------------|
| `PROPFIND` | List directory contents | Get file and folder lists, supports WebDAV clients |
| `GET` | Download file/browse directory | File downloads or HTML directory browsing pages |
| `PUT` | Upload file | Upload files to specified paths and folders |
| `DELETE` | Delete file/folder | Support for deleting individual files or entire directories |
| `OPTIONS` | Protocol detection | Returns supported WebDAV methods and features |
| `MKCOL` | Create directory | Create new folders (automatically supported) |

## 4.3 Deployment Configuration

### 4.3.1 Environment Variables

Set the following environment variables in your Cloudflare Worker:

```bash
# WebDAV authentication credentials
AUTH_USER=your_username          # WebDAV login username
AUTH_PASS=your_password          # WebDAV login password

# Upstream API configuration
UPSTREAM_HOST=your-imgbed.domain.com  # Your image bed domain
API_TOKEN=your_api_token         # API access token
```

### 4.3.2 Custom Domain Binding (Recommended)

For a better user experience, it's highly recommended to bind a custom domain to your WebDAV Worker:

1. **Prepare Domain**: Ensure you have an available domain that is hosted on Cloudflare
2. **Add Custom Route**:
   - Go to Cloudflare Workers console
   - Select your WebDAV Worker
   - Click the `Triggers` tab
   - Click `Add Custom Domain`
   - Enter your subdomain, e.g.: `webdav.yourdomain.com`
   - Click `Add Domain`

3. **SSL Certificate**: Cloudflare will automatically provide a free SSL certificate for your custom domain

**Advantages of Using Custom Domain**:
- 🌟 **Better Compatibility**: Avoid limitations some WebDAV clients have with `.workers.dev` domains
- 🔒 **Enhanced Security**: Custom domains are generally more trusted by clients
- 📱 **Mobile Friendly**: iOS/Android devices have better support for custom domains
- 🎯 **Brand Consistency**: Use a unified domain system with your image hosting service

## 4.4 Usage

### Browser Access
Access the Worker address directly in your browser and enter authentication credentials to browse file directories:
```
# Using custom domain (recommended)
https://webdav.yourdomain.com/

# Or using default Worker domain
https://your-webdav-worker.your-subdomain.workers.dev/
```

### WebDAV Clients
You can use any WebDAV-compatible client to connect:

**Windows File Explorer**:
1. Open "This PC"
2. Right-click and select "Add a network location"
3. Enter the WebDAV Worker address
4. Enter username and password

**macOS Finder**:
1. Press `Cmd+K` in Finder
2. Enter WebDAV address (custom domain recommended):
   - `https://webdav.yourdomain.com` or
   - `https://your-webdav-worker.your-subdomain.workers.dev`
3. Enter authentication credentials

**Third-party Clients**:
- File managers like Cyberduck, WinSCP, FileZilla Pro
- Mobile: FE File Explorer, Documents by Readdle, etc.

## 4.5 Key Features

- **Smart Path Handling**: Automatic path processing with support for Chinese characters and special characters
- **Paginated Loading**: Large directories are automatically paginated for improved performance
- **Error Handling**: Comprehensive error handling with user-friendly error messages
- **Cache Optimization**: Proper browser caching utilization for improved access speed
- **Secure & Reliable**: Based on Cloudflare Worker edge computing with global acceleration

Through WebDAV Bridge, you can manage hosted files just like using a local folder, achieving a true "cloud drive" experience!

# 5. Tips

- Frontend is open source, see [MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub).

- **Ecosystem**: We welcome community participation in the ecosystem construction. Feel free to submit PRs or Issues, and high-quality content can be found on the [official ecosystem page](https://cfbed.sanyue.de/en/about/ecosystem.html).

- **Sponsor**: Maintaining the project is not easy. If you like it, please support the author. Your support is the motivation to keep going~

  <a href="https://afdian.com/a/marseventh"><img width="200" src="https://pic1.afdiancdn.com/static/img/welcome/button-sponsorme.png" alt=""></a>
  
- **Sponsors**: Thanks to the following sponsors for supporting this project!

  [![sponsors](https://afdian-sponsors.sanyue.de/image)](https://afdian.com/a/marseventh)
  
- **Contributors**: Thanks to the following contributors for their selfless contributions!

  [![Contributors](https://contrib.rocks/image?repo=Marseventh/Cloudflare-ImgBed)](https://github.com/MarSeventh/CloudFlare-ImgBed/graphs/contributors)

# 5. Star History

**If you like the project, please give a free star✨✨✨, thank you very much!**

[![Star History Chart](https://api.star-history.com/svg?repos=MarSeventh/CloudFlare-ImgBed,MarSeventh/Sanyue-ImgHub&type=Date)](https://star-history.com/#MarSeventh/CloudFlare-ImgBed&MarSeventh/Sanyue-ImgHub&Date)

# 6. Special Sponsors

- **[CloudFlare](https://www.cloudflare.com) & [EdgeOne](https://edgeone.ai/?from=github)**：Provides CDN acceleration, and security protection

  <a href="https://www.cloudflare.com"><img src="static/readme/cloudflare-logo.png" alt="Cloudflare Logo" height="25"></a> <a href="https://edgeone.ai/?from=github"><img src="https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png" alt="Tencent Logo" height="25"></a>

- **[AsiaYun](https://www.asiayun.com) & [DartNode](https://dartnode.com)**：Provides cloud computing resources support

  [![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")
