<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️开源文件托管解决方案，基于 Cloudflare Pages，支持 Telegram Bot 、 Cloudflare R2 、S3 等多种存储渠道</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">简体中文</a>|<a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_en.md">English</a>|<a href="https://cfbed.sanyue.de">官方网站</a>
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

> v2.0 beta 版已发布，相较于 v1.0 版本进行了大量改动和优化，但 beta 版本可能存在潜在不稳定性，若您追求稳定，可选择暂缓更新。
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

## 最近更新（[更新日志](https://cfbed.sanyue.de/guide/update-log.html)）：

Add Features:

- 美化报错图片
- 上传页面支持预览ico等更多格式文件


# 1.Introduction

免费文件托管解决方案，具有**上传**、**管理**、**读取**、**删除**等全链路功能，覆盖文件全生命周期，支持**鉴权**、**目录**、**图片审查**、**随机图**等各项特性（详见[功能文档](https://cfbed.sanyue.de/guide/features.html)）。

![CloudFlare](static/readme/海报.png)

# 2.[Document](https://cfbed.sanyue.de)

提供详细的部署文档、功能文档、开发计划、常见问题解答等，帮助您快速上手。

# 3.Demo

**演示站点**：[CloudFlare ImgBed](https://cfbed.1314883.xyz/) 访问密码：`cfbed`

![image-20250313204101984](static/readme/202503132041511.png)

![image-20250313204138886](static/readme/202503132041072.png)

<details>
    <summary>其他页面效果展示</summary>

![image-20250313204308225](static/readme/202503132043466.png)

![image-20250314152355339](static/readme/202503141524797.png)

![image-20250313204325002](static/readme/202503132043265.png)



</details>


# 4.Tips

- 前端开源，参见[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)项目。

- **生态建设**：欢迎社区参与生态建设，欢迎提交 PR 或者 Issue，优质内容参见[官网生态建设页面](https://cfbed.sanyue.de/about/ecosystem.html)。

- **赞助**：项目维护不易，喜欢本项目的话，可以作者大大一点小小的鼓励哦，您的每一份支持都是我前进的动力\~ 

  <a href="https://afdian.com/a/marseventh"><img width="200" src="https://pic1.afdiancdn.com/static/img/welcome/button-sponsorme.png" alt=""></a>
  
- **Sponsors**：感谢以下赞助者对本项目的支持！

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
  
- **Contributors**：感谢以下贡献者对本项目的无私贡献！

  [![Contributors](https://contrib.rocks/image?repo=Marseventh/Cloudflare-ImgBed)](https://github.com/MarSeventh/CloudFlare-ImgBed/graphs/contributors)

# 5.Star History

**如果觉得项目不错希望您能给个免费的star✨✨✨，非常感谢！**

[![Star History Chart](https://api.star-history.com/svg?repos=MarSeventh/CloudFlare-ImgBed,MarSeventh/Sanyue-ImgHub&type=Date)](https://star-history.com/#MarSeventh/CloudFlare-ImgBed&MarSeventh/Sanyue-ImgHub&Date)

# 6.Special Sponsors

- **[亚洲云](https://www.asiayun.com/)**：提供云计算服务资源支持（高防服务器|福州高防|广东电信|香港服务器|美国服务器|海外服务器）

- **DartNode**：提供云计算服务资源支持

[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")
