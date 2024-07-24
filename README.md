# CloudFlare-ImgBed

**注意**：本仓库为[Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)项目的重制版，如果你觉得本项目不错，在支持本项目的同时，也请支持原项目。

## 1.Introduction

[cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)项目的重制版，实现了**登录鉴权**、**上传图片预览**、**一键切换上传方式**（**拖拽上传**、**粘贴上传**）、**多文件上传**、**整体复制**、**多格式复制**等功能。

![](https://alist.sanyue.site/d/imgbed/202407211140999.png)

![image-20240722104315281](https://alist.sanyue.site/d/imgbed/202407221043832.png)

![image-20240722104406761](https://alist.sanyue.site/d/imgbed/202407221044182.png)

![image-20240722104418816](https://alist.sanyue.site/d/imgbed/202407221052575.png)

## 2.Features

- **开源**
  - 前端开源（可自行修改、打包使用）

- **炫酷的动效（**
  - 流畅丝滑的过渡动画~
  - 上传文件实现呼吸灯效果
- **人性化上传**
  - 支持一键切换上传方式（**拖拽点击、粘贴**）
  - 支持批量上传（不限同时选择文件数量，但为了保证稳定性，同时处于上传状态的文件最多为10个）
  - 上传显示实时上传进度
  - **上传后图片无需手动点击，可直接展示在管理页面中**
- **多样化复制**
  - 支持整体复制和单独复制（整体复制即将所有链接通过换行串联起来后复制）
  - 支持MarkDown、HTML和原始链接三种格式复制
- **支持身份认证、防滥用**
  - 支持Web和API上传认证（感谢[hl128k](https://github.com/hl128k)）
  - 支持访问域名限制（感谢[hl128k](https://github.com/hl128k)

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

#### 后台管理

1. 默认关闭，开启方式如下：
   - 创建一个新的KV数据库
   - 进入项目对应`设置`->`函数`->`KV 命名空间绑定`->`编辑绑定`->`变量名称`，填写`img_url`，KV命名空间选择刚才创建好的KV数据库
   - 设置好后，访问`http(s)://你的域名/admin`即可进入后台管理页面
2. 管理员认证，默认关闭，开启方式如下：
   - 项目对应`设置`->`环境变量`->`为生产环境定义变量`->`编辑变量` ，添加`BASIC_USER`作为管理员用户名，`BASIC_PASS`作为管理员登录密码

#### 图片审查

支持成人内容审查和自动屏蔽，开启步骤如下：

- 前往https://moderatecontent.com/ 注册并获得一个免费的用于审查图像内容的 API key
- 打开 Cloudflare Pages 项目的管理页面，依次点击`设置`，`环境变量`，`添加环境变量`
- 添加一个`变量名称`为`ModerateContentApiKey`，`值`为第一步获得的`API key`，点击`保存`即可

#### Web和API上传认证

环境变量增加认证码`AUTH_CODE`，值为你想要设置的认证码。

Web端在登录页面输入你的**认证码**即可登录使用。

API格式：

| 接口名称     | /upload                                                      |
| ------------ | ------------------------------------------------------------ |
| **接口功能** | 上传图片或视频                                               |
| **请求参数** | **Query参数**：<br />`authCode`，string类型，即为你设置的认证码<br />**Body参数(application/form-data)**：<br />`file`，file类型，你要上传的文件 |
| **返回响应** | `data[0].src`为获得的图片链接（注意不包含域名，需要自己添加） |

> **请求示例**：
>
> ```bash
> curl --location --request POST 'https://your.domain/upload?authCode=your_authCode' \
> 
> --header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
> 
> --form 'file=@"D:\\杂文件\\壁纸\\genshin109.jpg"'
> ```
>
> **响应示例**：
>
> ```json
> [
>     {
>         "src": "/file/738a8aaacf4d88d1590f9.jpg"
>     }
> ]
> ```

#### 访问域名限制

环境变量增加`ALLOWED_DOMAINS`，多个允许的域名用英文`,`分割，如：域名.xyz,域名.cloudns.be,域名.pp.ua

#### 远端遥测

便于开发者进行bug的捕捉和定位，但是**过程中可能收集到访问链接、域名等信息**，如您不愿意泄露类似信息给项目开发者，可在环境变量中添加`disable_telemetry`为`true`来退出遥测。

#### 注意

**修改环境变量后需要重新部署才能生效！**

### 3.2定制化修改

按照`3.1`步骤部署完成后，前往仓库[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub?tab=readme-ov-file)，按照操作说明进行DIY和打包操作，最后将打包好的`/dist`目录中的内容替换到该仓库的根目录下即可（复制+替换）。

## 4.TODO

1. ~~增加粘贴图片上传功能（2024.7.22已完成）~~
2. ~~增加markdown、html等格式链接复制功能（2024.7.21已完成）~~
3. ~~上传页面增加管理端入口（2024.7.21已完成）~~

## 5.Tips

前端开源，参见[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub?tab=readme-ov-file)项目。

**如果觉得项目不错希望您能给个免费的star✨✨✨，非常感谢！**
