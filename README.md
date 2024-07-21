# CloudFlare-ImgBed

**注意**：本仓库为[Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)项目的重制版，如果你觉得本项目不错，在支持本项目的同时，也请支持原项目。

## 1.Introduction

[cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)项目的重制版，实现了**登录鉴权**、**上传图片预览**，**多文件上传**，**拖拽上传**，**整体复制**等功能。

![image-20240721113955315](https://alist.sanyue.site/d/imgbed/202407211140999.png)

![](https://alist.sanyue.site/d/imgbed/202407201643245.png)

![](https://alist.sanyue.site/d/imgbed/202407201643374.png)

## 2.Features

- 前端开源（可自行修改、打包使用）
- 流畅丝滑的过渡动画~
- 支持批量上传（不限同时选择文件数量，但为了保证稳定性，同时处于上传状态的文件最多为10个）
- 上传文件实现呼吸灯效果
- 上传显示实时上传进度
- 支持整体复制和单独复制（整体复制即将所有链接通过换行串联起来后复制）
- 上传后图片无需手动点击，可直接展示在管理页面中
- 支持Web和API上传认证（感谢[hl128k](https://github.com/hl128k)）
- 支持访问域名限制（感谢[hl128k](https://github.com/hl128k)）

## 3.Deployment

### 3.1直接使用

部署方式和环境变量和原仓库保持一致。

#### 提前准备

你唯一需要提前准备的就是一个 Cloudflare 账户 （如果需要在自己的服务器上部署，不依赖 Cloudflare，可参考[#46](https://github.com/cf-pages/Telegraph-Image/issues/46) ）

#### 手把手教程

简单 3 步，即可部署本项目，拥有自己的图床

1. Fork 本仓库 (注意：必须使用 Git 或者 Wrangler 命令行工具部署后才能正常使用，[文档](https://developers.cloudflare.com/pages/functions/get-started/#deploy-your-function))

2. 打开 Cloudflare Dashboard，进入 Pages 管理页面，选择创建项目，选择`连接到 Git 提供程序`

![1](https://alist.sanyue.site/d/imgbed/202407201047300.png)

3. 按照页面提示输入项目名称，选择需要连接的 git 仓库，点击`部署站点`即可完成部署

#### 后台管理及图片审核功能

请参照[原项目仓库](https://github.com/cf-pages/Telegraph-Image)设置对应的环境变量。

#### Web和API上传认证

环境变量增加`AUTH_CODE`，API使用如：https://cloudflare-imgbed.域名?authcode=`AUTH_CODE`

Web端在登录页面输入你的认证码即可。

#### 访问域名限制

环境变量增加`ALLOWED_DOMAINS`，多个允许的域名用英文`,`分割，如：域名.xyz,域名.cloudns.be,域名.pp.ua

### 3.2定制化修改

按照`3.1`步骤部署完成后，前往仓库[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub?tab=readme-ov-file)，按照操作说明进行DIY和打包操作，最后将打包好的`/dist`目录中的内容替换到该仓库的根目录下即可（复制+替换）。

## 4.TODO

1. 增加粘贴图片上传功能
2. 增加markdown、html等格式链接复制功能

## 5.Tips

前端开源，参见[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub?tab=readme-ov-file)项目。

**如果觉得项目不错希望您能给个免费的star✨✨✨，非常感谢！**
