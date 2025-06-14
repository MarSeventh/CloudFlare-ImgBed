<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️Open-source file hosting solution based on Cloudflare Pages, supporting multiple storage channels such as Telegram Bot, Cloudflare R2, S3, etc.</em></p>
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
> **Please check the announcement for upgrade notes on version 2.0!**

**🚀Project Website**: [CloudFlare ImgBed](https://cfbed.sanyue.de/)

<details>
    <summary>Announcement</summary>

## Pinned

1. If you encounter issues during deployment or usage, please carefully read the documentation, FAQ, and existing issues first.
2. **Frontend repository**: [MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)
3. **Note**: This repository is a remake of the [Telegraph-Image](https://github.com/cf-pages/Telegraph-Image) project. If you like this project, please support the original one as well.

## 2025.2.6 Version 2.0 Upgrade Notes

> The v2.0 beta version has been released, with many changes and optimizations compared to v1.0. However, the beta version may have potential instability. If you prefer stability, you may delay updating.
>
> Due to **changes in the build command**, this update requires **manual operation**. Please follow these steps:
>
> - Sync your forked repository to the latest version (ignore if already synced automatically)
> - Go to the Pages management page, enter `Settings` -> `Build`, edit the `Build configuration`, and set the `Build command` to `npm install`
>   ![image-20250212190315179](static/readme/202502121903327.png)
> - All new version settings have been **migrated to the Admin Panel -> System Settings** interface, so generally no need to configure environment variables anymore. Settings made in the system settings interface will **override** environment variable settings. However, to ensure compatibility of images uploaded via the Telegram channel with the old version, **please keep any previously set Telegram-related environment variables!**
> - After confirming the above settings are correct, go to the Pages management page, enter `Deployments`, and `Retry` the last failed deployment.

## Notification About Switching to Telegram Channel

> Due to abuse of the telegraph image hosting, the upload channel has switched to Telegram Channel. Please **update to the latest version (see the last section of chapter 3.1 for update instructions)** and set `TG_BOT_TOKEN` and `TG_CHAT_ID` according to the deployment requirements in the documentation, otherwise upload functionality will not work.
>
> Also, the **KV database is now mandatory**; if not configured before, please configure it as per the documentation.
>
> For issues, please check section 5 FAQ first.

</details>

<details>
    <summary>Ecosystem</summary>

## 1. Plugins

- **Auto upload inside editor (Tampermonkey script)**: https://greasyfork.org/zh-CN/scripts/529816-image-uploader-to-markdown-to-cloudflare-imgbed (Author: Linux.do: [calg_c](https://linux.do/u/calg_c/summary))

## 2. Repositories

- **Upload files to image hosting via TG BOT**: [uki0xc/img-up-bot: Upload using Telegram bot linked image hosting](https://github.com/uki0xc/img-up-bot?tab=readme-ov-file) (Author: [uki0xc](https://github.com/uki0xc))

</details>

<details>
    <summary>Experience Links and Quality Blogs/Videos (Good for learning deployment or usage issues)</summary>

**Experience site**: [CloudFlare ImgBed](https://cfbed.1314883.xyz/)

> Access code: cfbed

**Experience video**: [CloudFlare Free Image Hosting, easily protect your every wonderful moment! _ Bilibili](https://www.bilibili.com/video/BV1y3WGe4EGh/?vd_source=da5ecbe595e41089cd1bed95932b8bfd)

**Related tutorial videos**:

- [Build an online image hosting system using Cloudflare R2 + Pages, unlimited space, no blocking, super simple, completely free (youtube.com)](https://www.youtube.com/watch?v=T8VayuUMOzM)

**Related quality blogs (Thanks to every supportive contributor):**

- [CloudFlare-ImgBed project – yunsen2025's blog](https://www.yunsen2025.top/category/cloudflare-imgbed/)
  - [Completely free, step-by-step tutorial to build an unlimited space private image hosting with Cloudflare, supports authentication and adult content detection! - yunsen2025's blog](https://www.yunsen2025.top/blog-cfpages-syq-imgbed)
  - [Configure domestic CDN and split-line resolution for CloudFlare-ImgBed to enjoy ultimate speed at lowest cost! – yunsen2025's blog](https://www.yunsen2025.top/cloudflare-imgbed-fen-xian-pei-zhi-guo-nei-cdn/)
- [Build Telegram channel image hosting with Cloudflare Pages (lepidus.me)](https://blogstr.lepidus.me/post/1725801323700/)
- [Tutorial for free image hosting based on CloudFlare and Telegram - Liu Xueguan | Blog (sexy0769.com)](https://blog.sexy0769.com/skill/735.html)
- [CloudFlare + Github, build your own free image hosting - Datouding's small blog (luckyting.top)](https://luckyting.top/index.php/archives/20/)

</details>

## Recent Updates

Add Features:

- Beautify error images
- Upload page supports preview of ico and more formats

Update log: https://cfbed.sanyue.de/guide/update-log.html

# 1. Introduction

Free file hosting solution with full lifecycle features including **upload**, **management**, **read**, and **delete**, supporting **authentication**, **directories**, **image moderation**, **random images**, and other features.

![CloudFlare](static/readme/海报.png)

# 2. [Features](https://cfbed.sanyue.de/guide/features.html)

# 3. [Deployment](https://cfbed.sanyue.de/guide/quick-start.html)

# 4. Show

![image-20250313204101984](static/readme/202503132041511.png)

![image-20250313204138886](static/readme/202503132041072.png)

<details>
    <summary>Other page screenshots</summary>

![image-20250313204308225](static/readme/202503132043466.png)

![image-20250314152355339](static/readme/202503141524797.png)

![image-20250313204325002](static/readme/202503132043265.png)

</details>

# 5. TODO

## 5.1 Add Features 💕

<details>
    <summary>Feature update list</summary>

1. :white_check_mark: ~~Add paste image upload feature~~ (completed 2024.7.22)
2. :white_check_mark: ~~Add markdown, html format link copy~~ (completed 2024.7.21)
3. :white_check_mark: ~~Add admin panel entry on upload page~~ (completed 2024.7.21)
4. :memo: Add user customization interface
   - ~~Custom login and upload page backgrounds~~ (completed 2024.8.25)
   - ~~Custom image hosting name and logo~~ (completed 2024.8.26)
   - ~~Custom website title and icon~~ (completed 2024.8.26)
   - ~~Custom background switch interval~~ (completed 2024.9.11)
   - ~~Custom background opacity~~ (completed 2024.9.12)
   - ~~Custom footer portal~~ (completed 2024.10.20)
   - ~~Global custom link prefix~~ (completed 2024.12.27)
   - ~~Footer hide option~~ (completed 2025.2.4)
5. :white_check_mark: ~~Add random image API~~ (completed 2024.7.25)
6. :white_check_mark: ~~Improve multi-format link display, add UBB support~~ (completed 2024.8.21)
7. :white_check_mark: ~~Improve login logic, add backend auth code verification~~ (completed 2024.8.21)
8. :white_check_mark: ~~Support URL paste upload~~ (completed 2024.8.23)
9. :white_check_mark: ~~Auto compress images >5MB before upload~~ (completed 2024.8.26)
10. :white_check_mark: ~~Restyle upload page toolbar, support custom compression~~ (completed 2024.9.28)
11. :white_check_mark: ~~Refactor admin, add authentication and display optimization, add image detail page~~ (completed 2024.12.20)
12. :white_check_mark: ~~Add visit statistics, IP record, IP blacklist, upload IP blacklist in admin~~ (upload IP blacklist done, visit record postponed)
13. :white_check_mark: ~~Auto copy link on upload page click~~ (completed 2024.9.27)
14. :white_check_mark: ~~Upload settings memory (method, link format)~~ (completed 2024.9.27, merged upload methods)
15. :white_check_mark: ~~No password set, no redirect to login~~ (completed 2024.9.27)
16. :white_check_mark: ~~Add delete only successful uploads, retry failed uploads~~ (completed 2024.9.28)
17. :white_check_mark: ~~Optimize file naming on paste upload~~ (completed 2024.9.26)
18. :white_check_mark: ~~Add R2 bucket support~~ (completed 2024.11.5)
19. :white_check_mark: ~~Add batch blacklist and whitelist in admin~~ (completed 2024.12.14)
20. :white_check_mark: ~~Telegram Channel upload records bot and channel data for migration/backup~~ (completed 2024.12.4)
21. :white_check_mark: ~~Support custom naming methods~~ (completed 2024.12.4)
22. :white_check_mark: ~~Support auto retry with other channels on upload failure~~ (completed 2024.12.12)
23. :white_check_mark: ~~Backend list API pagination~~ (completed 2024.2.5)
24. :white_check_mark: ~~Support custom link prefix~~ (completed 2024.12.4)
25. :memo: Integrate alist or implement webdav (under evaluation)
26. :white_check_mark: ~~Add file size record in details~~ (completed 2024.12.10)
27. :white_check_mark: ~~Support admin custom global default link prefix~~ (completed 2025.2.1)
28. :white_check_mark: ~~Open more file formats~~ (completed 2024.12.9)
29. :white_check_mark: ~~Auto clear CF CDN cache on delete, whitelist, blacklist~~ (completed 2024.12.11)
30. :white_check_mark: ~~Admin batch selection remembers user order~~ (completed 2024.12.20)
31. :memo: Support custom upload path and album feature
    - ~~Folder delete~~ (completed 2025.3.6)
    - ~~File move~~ (completed 2025.3.7)
    - ~~Fix ghost click bug on admin load more~~ (completed 2025.3.6)
    - ~~Batch operations support folders~~ (completed 2025.3.6)
    - ~~Admin pagination logic adjustment~~ (completed 2025.3.6)
32. :white_check_mark: ~~Support multiple Telegram Bot Token load balancing~~ (completed 2025.2.4)
33. :white_check_mark: ~~Admin provides detailed setting info and guidance~~ (completed 2025.2.5)
34. :white_check_mark: ~~Logo redesign, login page optimization, setting tooltips~~ (completed 2025.2.2)
35. :white_check_mark: ~~Add S3 API channel~~ (completed 2024.2.3)
36. :white_check_mark: ~~Support short link naming~~ (completed 2025.2.1)
37. :white_check_mark: ~~Support dark mode~~ (completed 2025.1.11)
38. :hourglass_flowing_sand: Support KV backup and restore
39. :white_check_mark: ~~Footer can be hidden~~ (completed 2025.2.4)
40. :hourglass_flowing_sand: Search function enhancement
41. :white_check_mark: Support pasting multiple links and external link management
42. :hourglass_flowing_sand: Upload file MD5 record and hard link support
43. :hourglass_flowing_sand: Upload page recent uploads display
44. :hourglass_flowing_sand: Configure upload page default settings from admin
45. :white_check_mark: Add announcement feature
46. :hourglass_flowing_sand: Support width/height params on image access
47. :hourglass_flowing_sand: Support image format conversion on upload

</details>

## 5.2 Fix Bugs 👻

<details>
    <summary>Bug fix list</summary>

1. :white_check_mark: ~~Fix API upload not showing in backend~~ (fixed 2024.7.25)
2. :white_check_mark: ~~Migrate upload to TG channel due to telegra.ph closure~~ (fixed 2024.9.7)
3. :white_check_mark: ~~Fix infinite refresh when no admin auth set~~ (fixed 2024.9.9)
4. :white_check_mark: ~~Fix some videos not previewing (likely file issue)~~
5. :hourglass_flowing_sand: Add new image moderation channel
6. :white_check_mark: ~~R2 channel deletes bucket synchronously in admin~~ (fixed 2024.12.4)
7. :white_check_mark: ~~Add CORS header `access-control-allow-origin: *` in file response~~ (fixed 2024.12.9)
8. :white_check_mark: ~~Add upload page access restriction whitelist~~ (fixed 2024.12.11)
9. :white_check_mark: Fix long file names covering buttons
10. :white_check_mark: Fix `list` API data completeness

</details>

# 6. [Q&A](https://cfbed.sanyue.de/qa/)

# 7. Tips

- Frontend is open source, see [MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub).

- **Sponsor**: Maintaining the project is not easy. If you like it, please support the author. Your support is the motivation to keep going~

  <a href="https://afdian.com/a/marseventh"><img width="200" src="https://pic1.afdiancdn.com/static/img/welcome/button-sponsorme.png" alt=""></a>
  
- **Sponsors**: Thanks to the following sponsors for supporting this project!

  <a href="https://afdian.com/a/nothin">
        <img src="https://pic1.afdiancdn.com/user/e8af1436138e11ed945852540025c377/avatar/59db0533d82e4198f59e63df63a1917f_w640_h640_s114.jpeg?imageView2/1/w/240/h/240" width="80"/>
      </a> <a href="https://afdian.com/u/1acef0be02d911ee90695254001e7c00">
        <img src="https://pic1.afdiancdn.com/default/avatar/avatar-orange.png?imageView2/1/w/240/h/240" width="80"/></a><a href="https://afdian.com/u/412189a0284911eca59f52540025c377">
        <img src="https://pic1.afdiancdn.com/default/avatar/avatar-orange.png?imageView2/1/w/120/h/120" width="80"/></a><a href="https://afdian.com/u/5e52ece217bc11f0ae3352540025c377">
        <img src="https://pic1.afdiancdn.com/default/avatar/avatar-purple.png?imageView2/1/" width="80"/></a><a href="https://afdian.com/u/42e1c47e16a411f0baff52540025c377">
        <img src="https://pic1.afdiancdn.com/default/avatar/avatar-purple.png?imageView2/1/" width="80"/></a><a href="https://afdian.com/a/yono233">
        <img src="https://pic1.afdiancdn.com/user/73b45190c98711eeaa425254001e7c00/avatar/26afa95554d4bbcd748e6432ab56f824_w580_h580_s145.jpeg?imageView2/1/w/240/h/240" width="80"/></a><a href="https://afdian.com/a/XinToolKit">
        <img src="https://pic1.afdiancdn.com/user/a1c1cb08695c11edb9e352540025c377/avatar/83d5cc8895f5357e627e86aabd9f848e_w1080_h1028_s317.jpg?imageView2/1/w/240/h/240" width="80"/></a><a href="https://www.yunsen2025.top">
        <img src="https://pic1.afdiancdn.com/user/b9aa4780aa1c11edab6c52540025c377/avatar/0c75630cfa3ac6a921acd8cc2a55505a_w1024_h1024_s42.jpeg?imageView2/1/w/120/h/120" width="80"/></a>
  
- **Contributors**: Thanks to the following contributors for their selfless contributions!

  [![Contributors](https://contrib.rocks/image?repo=Marseventh/Cloudflare-ImgBed)](https://github.com/MarSeventh/CloudFlare-ImgBed/graphs/contributors)

# 8. Star History

**If you like the project, please give a free star✨✨✨, thank you very much!**

[![Star History Chart](https://api.star-history.com/svg?repos=MarSeventh/CloudFlare-ImgBed,MarSeventh/Sanyue-ImgHub&type=Date)](https://star-history.com/#MarSeventh/CloudFlare-ImgBed&MarSeventh/Sanyue-ImgHub&Date)

# 9. Special Sponsors

- **[AsiaYun](https://www.asiayun.com/)**: Provides cloud computing resources support (high defense servers | Fuzhou high defense | Guangdong Telecom | Hong Kong servers | US servers | Overseas servers)

- **DartNode**: Provides cloud computing resources support

[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")