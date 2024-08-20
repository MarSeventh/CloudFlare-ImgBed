# CloudFlare-ImgBed

**注意**：本仓库为[Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)项目的重制版，如果你觉得本项目不错，在支持本项目的同时，也请支持原项目。

## 1.Introduction

[cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)项目的重制版，实现了**登录鉴权**、**上传图片预览**、**一键切换上传方式**（**拖拽上传**、**粘贴上传**）、**多文件上传**、**整体复制**、**多格式复制**等功能。

![](https://alist.sanyue.site/d/imgbed/202408191757569.png)

![](https://alist.sanyue.site/d/imgbed/202407221043832.png)

![](https://alist.sanyue.site/d/imgbed/202407221044182.png)

![](https://alist.sanyue.site/d/imgbed/202407221052575.png)

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
  - 支持访问域名限制（感谢[hl128k](https://github.com/hl128k)）
- **一些小功能**
  - 支持随机图API，从图床中随机返回一张图片


## 3.Deployment

### 3.1直接使用

**部署方式**与**环境变量**和原仓库保持一致。

#### 3.1.1提前准备

- **部署于Cloudflare**

  只需准备一个**Cloudflare账户**，然后按照[3.1.2.1节](#3.1.2.1部署于Cloudflare)的步骤即可完成部署。

- **部署于服务器**

  如果Cloudflare的**有限访问次数**不能满足你的需求，并且你拥有自己的服务器，可以参照[3.1.2.2节](#3.1.2.2部署于服务器)的教程在服务器上模拟Cloudflare的环境，并开放对应的端口访问服务。

  注意由于服务器操作系统、硬件版本复杂多样，相关教程**无法确保适合每一位用户**，遇到报错请尽量利用搜索引擎解决，无法解决也可以提issue寻求帮助。

#### 3.1.2手把手教程

##### 3.1.2.1部署于Cloudflare

依托于CF的强大能力，只需简单 3 步，即可部署本项目，拥有自己的图床。

1. Fork 本仓库 (注意：必须使用 Git 或者 Wrangler 命令行工具部署后才能正常使用，[文档](https://developers.cloudflare.com/pages/functions/get-started/#deploy-your-function))

2. 打开 Cloudflare Dashboard，进入 Pages 管理页面，选择创建项目，选择`连接到 Git 提供程序`

![1](https://alist.sanyue.site/d/imgbed/202407201047300.png)

3. 按照页面提示输入项目名称，选择需要连接的 git 仓库，点击`部署站点`即可完成部署

##### 3.1.2.2部署于服务器

1. 安装服务器操作系统对应的`node.js`，经测试`v22.5.1`版本可以正常使用。（安装教程自行search）

2. 切换到项目根目录，运行`npm install`，安装所需依赖。

3. 在项目根目录下新建`wrangler.toml`配置文件，其内容为项目名称，环境变量等，可根据后文环境变量配置进行个性化修改。（详情参见官方文档[Configuration - Wrangler (cloudflare.com)](https://developers.cloudflare.com/workers/wrangler/configuration/)）

   > 配置文件样例：
   >
   > ```toml
   > name = "cloudflare-imgbed"
   > compatibility_date = "2024-07-24"
   > 
   > [vars]
   > ModerateContentApiKey = "your_key"
   > AllowRandom = "true"
   > BASIC_USER = "user"
   > BASIC_PASS = "pass"
   > ```

4. 在项目根目录下运行`npm run start`，至此，正常情况下项目已经成功部署。

   程序默认运行在`8080`端口上，使用`nginx`等服务器反代`127.0.0.1:8080`即可外网访问服务。如需修改端口，可在`package.json`中修改`start`脚本的`port`参数（如下图）。

   ![](https://alist.sanyue.site/d/imgbed/202408191832173.png)

   正常启动，控制台输出如下：

   ![202408191829163](https://alist.sanyue.site/d/imgbed/202408191855625.png)

#### 3.1.3后台管理

1. 默认关闭，开启方式如下：
   - 创建一个新的KV数据库
   - 进入项目对应`设置`->`函数`->`KV 命名空间绑定`->`编辑绑定`->`变量名称`，填写`img_url`，KV命名空间选择刚才创建好的KV数据库
   - 设置好后，访问`http(s)://你的域名/admin`即可进入后台管理页面
2. 管理员认证，默认关闭，开启方式如下：
   - 项目对应`设置`->`环境变量`->`为生产环境定义变量`->`编辑变量` ，添加`BASIC_USER`作为管理员用户名，`BASIC_PASS`作为管理员登录密码

#### 3.1.4图片审查

支持成人内容审查和自动屏蔽，开启步骤如下：

- 前往https://moderatecontent.com/ 注册并获得一个免费的用于审查图像内容的 API key
- 打开 Cloudflare Pages 项目的管理页面，依次点击`设置`，`环境变量`，`添加环境变量`
- 添加一个`变量名称`为`ModerateContentApiKey`，`值`为第一步获得的`API key`，点击`保存`即可

#### 3.1.5Web和API上传认证

环境变量增加认证码`AUTH_CODE`，值为你想要设置的认证码。

Web端在登录页面输入你的**认证码**即可登录使用。

API格式：

| 接口名称     | /upload                                                      |
| ------------ | ------------------------------------------------------------ |
| **接口功能** | 上传图片或视频                                               |
| **请求方法** | POST                                                         |
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

#### 3.1.6访问域名限制

环境变量增加`ALLOWED_DOMAINS`，多个允许的域名用英文`,`分割，如：`域名.xyz,域名.cloudns.be,域名.pp.ua`

#### 3.1.7远端遥测

便于开发者进行bug的捕捉和定位，但是**过程中可能收集到访问链接、域名等信息**，如您不愿意泄露类似信息给项目开发者，可在环境变量中添加`disable_telemetry`为`true`来退出遥测。

#### 3.1.8随机图API

| 接口名称     | /random                                                      |
| ------------ | ------------------------------------------------------------ |
| **接口功能** | 从图床中随机返回一张图片的链接（注意会消耗列出次数）         |
| **前置条件** | 设置`AllowRandom`环境变量，值为`true`                        |
| **请求方法** | GET                                                          |
| **请求参数** | **Query参数**：<br />`type`：设为`img`时直接返回图片（此时form不生效）；设为`url`时返回完整url链接；否则返回随机图的文件路径。<br />`form`:设为`text`时直接返回文本，否则返回json格式内容。 |
| **响应格式** | 1、当`type`为`img`时：<br />返回格式为`image/jpeg`<br />2、当`type`为其他值时：<br />当`form`不是`text`时，返回JSON格式内容，`data.url`为返回的链接/文件路径。<br />否则，直接返回链接/文件路径。 |

> **请求示例**：
>
> ```bash
> curl --location --request GET 'https://your.domain/random' \
> --header 'User-Agent: Apifox/1.0.0 (https://apifox.com)'
> ```
>
> **响应示例**：
>
> ```json
> {
>     "url": "/file/4fab4d423d039b4665a27.jpg"
> }
> ```

#### 3.1.9注意

**修改环境变量后需要重新部署才能生效！**

### 3.2定制化修改

按照`3.1`步骤部署完成后，前往仓库[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub?tab=readme-ov-file)，按照操作说明进行DIY和打包操作，最后将打包好的`/dist`目录中的内容替换到该仓库的根目录下即可（复制+替换）。

## 4.TODO

### 4.1Add Features💕

1. ~~增加粘贴图片上传功能（2024.7.22已完成）~~
2. ~~增加markdown、html等格式链接复制功能（2024.7.21已完成）~~
3. ~~上传页面增加管理端入口（2024.7.21已完成）~~
4. 增加用户个性化配置接口
5. ~~增加随机图API（2024.7.25已完成）~~
6. 完善多格式链接展示形式，增加ubb格式链接支持

### 4.2Fix Bugs👻

1. ~~修复API上传无法直接展示在后台的问题（2024.7.25已修复）~~

## 5.Q&A

### 5.1未设置`ALLOWED_DOMAINS`，但无法跨域访问？

- 请检查你的cloudflare防火墙设置（例如hotlink保护是否开启）
- 参见[Issue #8](https://github.com/MarSeventh/CloudFlare-ImgBed/issues/8)

## 6.Tips

前端开源，参见[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub?tab=readme-ov-file)项目。

**如果觉得项目不错希望您能给个免费的star✨✨✨，非常感谢！**

## 7.Star History

[![Star History Chart](https://api.star-history.com/svg?repos=MarSeventh/CloudFlare-ImgBed&type=Date)](https://star-history.com/#MarSeventh/CloudFlare-ImgBed&Date)
