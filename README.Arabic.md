<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️حلول استضافة الملفات مفتوحة المصدر، تعتمد على Cloudflare Pages، تدعم Telegram Bot و Cloudflare R2 و S3 وغيرها من قنوات التخزين المتعددة</em></p>
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
> **يرجى مراجعة ملاحظات ترقية الإصدار v2.0 في الإعلان!**

<details>
    <summary>الإعلان</summary>



## 置顶

1. إذا واجهت مشاكل في النشر، يرجى مراجعة الوثائق، الأسئلة الشائعة، والمشاكل الموجودة مسبقًا بعناية.

2. **مستودع الواجهة الأمامية**：[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)

3. **ملاحظة**: هذا المستودع هو نسخة معاد تصميمها من مشروع [Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)، إذا كنت تعتقد أن هذا المشروع جيد، يرجى دعم المشروع الأصلي أيضًا.

## 2025.2.6  ملاحظات ترقية الإصدار V2.0

> تم إصدار النسخة التجريبية v2.0، وقد تم إجراء العديد من التغييرات والتحسينات مقارنة بالإصدار v1.0، ولكن قد تحتوي النسخة التجريبية على عدم استقرار محتمل، إذا كنت تبحث عن الاستقرار، يمكنك تأجيل التحديث.
>
> نظرًا لأن **أمر البناء قد تغير**، يتطلب هذا التحديث منك **إجراء التحديث يدويًا**، يرجى اتباع الخطوات التالية:
>
> - مزامنة المستودع المفرع إلى أحدث إصدار (إذا تم المزامنة تلقائيًا، يمكنك تجاهل ذلك)
>
> - انتقل إلى صفحة إدارة الصفحات، واذهب إلى `الإعدادات`->`البناء`، وقم بتحرير `تكوين البناء`، في حقل `أمر البناء`، اكتب `npm install`
>
>   ![image-20250212190315179](static/readme/202502121903327.png)
>
> - تم **نقل جميع إعدادات النسخة الجديدة** إلى واجهة إدارة النظام->الإعدادات، من حيث المبدأ، لا حاجة لتعيينها عبر متغيرات البيئة، ستقوم الإعدادات التي تتم عبر واجهة إعدادات النظام **بتجاوز** الإعدادات في متغيرات البيئة، ولكن لضمان أن **صور قنوات Telegram** يمكن أن تتوافق مع الإصدارات القديمة، **إذا كنت قد قمت بتعيين متغيرات البيئة المتعلقة بقناة Telegram، يرجى الاحتفاظ بها!**
>
> - تأكد من أن الإعدادات المذكورة أعلاه قد اكتملت بشكل صحيح، ثم انتقل إلى صفحة إدارة الصفحات، واذهب إلى `النشر`، وقم بإجراء `إعادة محاولة` للنشر الأخير الذي لم ينجح

## حول إشعار الانتقال إلى قناة Telegram


> نظرًا لسوء استخدام telegraph، تم تغيير قناة تحميل المشروع إلى قناة Telegram، يرجى **التحديث إلى أحدث إصدار (طريقة التحديث انظر في القسم 3.1 في نهاية الفصل)**، وفقًا لمتطلبات النشر في الوثائق **قم بتعيين `TG_BOT_TOKEN` و `TG_CHAT_ID`**، وإلا فلن تتمكن من استخدام وظيفة التحميل بشكل طبيعي.
>
> بالإضافة إلى ذلك، فإن **قاعدة بيانات KV مطلوبة**، إذا لم تكن قد قمت بتكوينها من قبل، يرجى اتباع تعليمات الوثائق لتكوينها.
>
> إذا واجهت مشاكل، يرجى مراجعة القسم 5 من الأسئلة الشائعة Q&A.

</details>

<details>
    <summary>بناء النظام البيئي</summary>



## 1. الإضافات

- **التحميل التلقائي داخل المحرر (سكريبت تم استخدامه)**: https://greasyfork.org/zh-CN/scripts/529816-image-uploader-to-markdown-to-cloudflare-imgbed （_المؤلف: Linux.do: [calg_c](https://linux.do/u/calg_c/summary)_）

## 2. المستودعات

- **إرسال الملفات إلى TG BOT لتحميل الصور**：[uki0xc/img-up-bot: استخدام روبوت Telegram لربط الصور وتحميلها](https://github.com/uki0xc/img-up-bot?tab=readme-ov-file) （_المؤلف：[uki0xc](https://github.com/uki0xc)_)



</details>

<details>
    <summary>عنوان التجربة والمقالات والفيديوهات عالية الجودة (إذا كان لديك مشاكل في الإعداد أو الاستخدام، يمكنك الذهاب إلى هناك للتعلم أولاً~)</summary>


**عنوان التجربة**：[CloudFlare ImgBed](https://cfbed.1314883.xyz/)

> رمز الوصول: cfbed

**فيديو التجربة**：[CloudFlare免费图床，轻松守护你的每一份精彩！_哔哩哔哩_bilibili](https://www.bilibili.com/video/BV1y3WGe4EGh/?vd_source=da5ecbe595e41089cd1bed95932b8bfd)

**فيديوهات تعليمية ذات صلة**：

- [利用Cloudflare R2 +Pages搭建在线图床系统，不限空间，不被墙，超级简单，完全免费 (youtube.com)](https://www.youtube.com/watch?v=T8VayuUMOzM)

**مقالات عالية الجودة ذات صلة (شكرًا لكل من دعم المشروع بجهودهم)**：

- [CloudFlare-ImgBed项目 – yunsen2025的小窝](https://www.yunsen2025.top/category/cloudflare-imgbed/)
  - [完全免费，图文教程手把手教你使用cloudflare搭建一个无限空间的私人图床 支持身份认证与成人元素鉴定！ - yunsen2025的小窝](https://www.yunsen2025.top/blog-cfpages-syq-imgbed)
  - [为CloudFlare-ImgBed图床配置国内CDN并分线路解析，以最低成本享受极致速度！ – yunsen2025的小窝](https://www.yunsen2025.top/cloudflare-imgbed-fen-xian-pei-zhi-guo-nei-cdn/)
- [利用cloudflare pages搭建telegram频道图床 (lepidus.me)](https://blogstr.lepidus.me/post/1725801323700/)
- [搭建基于CloudFlare和Telegram的免费图床教程 - 刘学馆 | Blog (sexy0769.com)](https://blog.sexy0769.com/skill/735.html)
- [CloudFlare+Github，打造属于自己的免费图床 - 大头钉的小小blog (luckyting.top)](https://luckyting.top/index.php/archives/20/)

</details>



## 最近更新

Add Features:

- 美化报错图片
- 上传页面支持预览ico等更多格式文件



<details>
    <summary>更新日志</summary>


## 2025.6.13

Add Features:

- 美化报错图片
- 上传页面支持预览ico等更多格式文件

## 2025.6.12

Add Features:

- `upload`接口支持跨域访问和调用

Fix Bugs:

- 修复`list`接口返回数据完整性的问题

## 2025.5.23

Add Features:

- 增加公告功能

Fix Bugs:

- 修复后台图片名过长遮盖图片的问题
- 优化部分页面显示效果
- 修复 Docker 镜像无法访问 https 外链的问题

## 2025.5.11

Add Features:

- 支持通过Docker在服务器上部署

## 2025.3.14

Add Features:

- 上传用户管理支持显示IP具体位置

## 2025.3.8

Add Features:

- 随机图API支持按目录读取，支持按目录进行权限控制

Fix Bugs:

- 修复随机图API的缓存问题

## 2025.3.7

Add Features:

- **目录功能上线啦**，当前支持：
  - 上传到指定目录
  - 整目录删除
  - 文件位置移动（ Telegraph 和旧版 Telegram 渠道不支持移动）
  - 按目录读取文件
- 随机图API支持按目录读取

Fix Bugs:

- 修复多项影响体验的bug

## 2025.3.1

Add Features:

- 支持粘贴多个链接同时上传
- 支持存储和管理外链

Fix Bugs:

- 修复管理端复制 S3 链接的有关问题
- 修复管理端部分页面设置不生效的问题
- 修复渠道设置某些情况下不能保存的问题

## 2025.2.6

**v2.0版本焕新登场**，带来多项新功能和优化，给您焕然一新的用户体验：

💪**更强大**：

- 接入 S3 API 渠道，支持 Cloudflare R2 , Backblaze B2 ，七牛云，又拍云等多个服务商的对象存储服务
- 支持设置多个 Telegram 和 S3 渠道，支持多渠道负载均衡
- 上传文件支持短链接命名方式

✈️**更高效**：

- 全部设置项迁移到管理端系统设置界面，无需进行环境变量的繁琐配置，立即设置立即生效
- 管理端 Gallery 和 用户管理 等页面实现分页读取，提升前端渲染速度，优化使用体验
- 支持禁用、启用渠道，渠道管理自在掌握
- 多个设置项加入提示弹窗，不用到处翻阅文档，设置更踏实

✨**更精致**：

- 全局支持深色模式，根据用户喜好和时间自动切换，凸显满满高级感
- 登陆页面、图库页面、用户管理页面等多个页面细节重新打磨，操作更直观
- 上传页全新 Tab 栏，一拉一合，灵动又便捷
- Logo 焕新，纯手工打造，能力有限，不喜勿喷（
- 支持自定义隐藏页脚，强迫症患者有救啦

## 2024.12.27

Add Features:

- 支持通过环境变量自定义全局默认链接前缀（见3.1.3.6自定义配置接口）
- 管理端支持自定义链接前缀
- 管理端部分页面展示效果优化
- `/upload`API支持返回完整链接（请求时设置`returnFormat`参数，详见API文档）

Fix Bugs:

- 优化上传页面显示效果

## 2024.12.20

Add Features:

- 管理端支持拉黑上传IP（Dashboard->用户管理->允许上传）
- 管理端批量操作支持按照用户选择的顺序进行（[#issue124](https://github.com/MarSeventh/CloudFlare-ImgBed/issues/124)）
- `random`接口优化，减少KV操作次数，增加`content`参数，支持返回指定类型的文件
- 接入CloudFlare Cache API，提升 list 相关接口访问速度
- 正常读取返回图片的CDN缓存时间从1年调整为7天，防止缓存清除不成功的情况下图片长时间内仍可以访问的问题

## 2024.12.14

Add Features:

- 管理端增加批量黑名单、白名单功能

## 2024.12.13

Add Features:

- 优化blockimg、whitelistmode、404等返回状态的缓存策略，尽可能减少回源请求(参考文档`3.1.3.9管理端删除、拉黑等操作优化`进行设置)

## 2024.12.12

Add Features: 

- 后端支持上传失败自动切换其他渠道重试
- 优化404、blockimg、whitelistmode等返回状态的显示样式

## 2024.12.11

Add Features:

- 进行删除、加入白名单、加入黑名单等操作时，自动清除CF CDN缓存，避免延迟生效(参考文档`3.1.3.9管理端删除、拉黑等操作优化`进行设置)

## 2024.12.10

Add Features:

- 文件详情增加文件大小记录

## 2024.12.09

Add Features:

- 开放更多文件格式

Fix Bugs:

- 读取文件响应头增加允许跨域头`access-control-allow-origin: *`

## 2024.12.04

Add Features:

- 支持自定义命名方式（仅原名 or 仅随机前缀 or 默认的随机前缀_原名）
- Telegram Channel渠道上传文件记录机器人和频道数据，便于迁移和备份
- 支持自定义链接前缀

Fix Bugs:

- R2渠道在管理端删除时，存储桶同步删除

## 2024.11.05

Add Features:

- 增加对R2 bucket的支持

## 2024.10.20

Add Features:

- 页脚增加自定义传送门功能

## 2024.09.28

Add Features:

- 上传页面右下角工具栏样式重构，支持上传页自定义压缩（上传前+存储端）
- 增加仅删除上传成功图片、上传失败图片重试

## 2024.09.27

Add Features:

- 上传页面点击链接时，自动复制到剪切板
- 上传设置记忆（上传方式、链接格式等）

Fix Bugs:

- 若未设置密码，无需跳转登录页

## 2024.09.26

Add Features:

- 优化粘贴上传时的文件命名方法

## 2024.09.12

Add Features:

- 增加背景透明度支持自定义

## 2024.09.11

Add Features:

- 支持背景切换时间自定义

## 2024.08.26

Add Features:

- 支持大于5MB的图片上传前自动压缩
- 图床名称和Logo支持自定义
- 网站标题和Icon支持自定义

## 2024.08.23

Add Features:

- 支持URL粘贴上传

## 2024.08.21

Add Features:

- 完善多格式链接展示形式，增加UBB格式链接支持
- 完善登录逻辑，后端增加认证码校验接口

## 2024.07.25

Add Features:

- 增加随机图API

Fix Bugs:

- 修复API上传无法直接展示在后台的问题

## 2024.07.22

Add Features:

- 增加粘贴图片上传功能

## 2024.07.21

Add Features:

- 增加Markdown、HTML等格式链接复制功能
- 上传页面增加管理端入口

</details>

# 1.Introduction

حلول استضافة الملفات المجانية، تحتوي على وظائف **التحميل**، **الإدارة**، **القراءة**، **الحذف**، تغطي دورة حياة الملفات بالكامل، تدعم **المصادقة**، **الدليل**، **مراجعة الصور**، **الصور العشوائية** وغيرها من الميزات.

![CloudFlare](static/readme/海报.png)

# 2.Features

<details>
    <summary>خصائص المشروع</summary>

- **مفتوح المصدر**
  
  - الواجهة الأمامية مفتوحة المصدر (يمكن تعديلها وتجميعها للاستخدام)
  
- **تأثيرات رائعة (**
  
  - انتقالات سلسة وناعمة~
  - تأثيرات ضوء التنفس عند تحميل الملفات
  - تجربة استخدام مرنة
  
- **تحميل سهل الاستخدام**
  
  - **يدعم معظم تنسيقات الملفات**: يدعم معظم **الصور، الفيديوهات، المتحركات** الشائعة، كما يدعم معظم تنسيقات الملفات الأخرى
  
  - **يدعم قنوات تخزين متعددة**: يدعم **Telegram Bot** و **Cloudflare R2** و **S3** وغيرها من قنوات التخزين مع تبديل بنقرة واحدة
  
    > قناة Telegram Bot: الحد الأقصى لحجم الملف المرفوع هو 20MB، يوفر وظائف ضغط على جانب العميل والخادم
   