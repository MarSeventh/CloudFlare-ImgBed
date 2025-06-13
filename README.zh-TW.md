<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️開源文件托管解決方案，基於 Cloudflare Pages，支持 Telegram Bot 、 Cloudflare R2 ，S3 等多種存儲渠道</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">簡體中文</a>|<a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_en.md">English</a>
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
> **v2.0 版本升級注意事項請查看公告！**

<details>
    <summary>公告</summary>



## 置頂

1. 部署使用出現問題，請先仔細查閱文檔、常見問題解答以及已有issues。

2. **前端倉庫**：[MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)

3. **注意**：本倉庫為[Telegraph-Image](https://github.com/cf-pages/Telegraph-Image)項目的重製版，如果你覺得本項目不錯，在支持本項目的同時，也請支持原項目。

## 2025.2.6  V2.0 版本升級注意事項

> v2.0 beta 版已發布，相較於 v1.0 版本進行了大量改動和優化，但 beta 版本可能存在潛在不穩定性，若您追求穩定，可選擇暫緩更新。
>
> 由於**構建命令發生了變化**，此次更新需要您**手動進行**，請按照以下步驟進行操作：
>
> - 同步fork的倉庫至最新版（若已自動同步可忽略）
>
> - 前往 pages 管理頁面，進入`設置`->`構建`，編輯`構建配置`，在`構建命令`處填寫`npm install`
>
>   ![image-20250212190315179](static/readme/202502121903327.png)
>
> - 新版本所有設置項已**遷移至 管理端->系統設置 界面**，原則上無需再通過環境變量的方式進行設置，通過系統設置界面進行的設置將**覆蓋掉**環境變量中的設置，但為了保證 **Telegram渠道的圖片** 能夠與舊版本相兼容，**若您之前設置了 Telegram 渠道相關的環境變量，請將其保留！**
>
> - 確保上述設置完成無誤後，前往 pages 管理頁面，進入`部署`，對最後一次不成功的部署進行`重試操作`

## 關於切換到 Telegram 渠道的通知


> 由於telegraph圖床被濫用，該項目上傳渠道已切換至Telegram Channel，請**更新至最新版（更新方式見第3.1章最後一節）**，按照文檔中的部署要求**設置`TG_BOT_TOKEN`和`TG_CHAT_ID`**，否則將無法正常使用上傳功能。
>
> 此外，目前**KV數據庫為必須配置**，如果以前未配置請按照文檔說明配置。
>
> 出現問題，請先查看第5節常見問題Q&A部分。

</details>

<details>
    <summary>生態建設</summary>



## 1. 插件

- **編輯器內自動上傳（油猴腳本）**：https://greasyfork.org/zh-CN/scripts/529816-image-uploader-to-markdown-to-cloudflare-imgbed （_作者：Linux.do: [calg_c](https://linux.do/u/calg_c/summary)_）

## 2.倉庫

- **向TG BOT發送文件上傳圖床**：[uki0xc/img-up-bot: 使用telegram機器人鏈接圖床進行上傳](https://github.com/uki0xc/img-up-bot?tab=readme-ov-file) （_作者：[uki0xc](https://github.com/uki0xc)_)



</details>

<details>
    <summary>體驗地址及優質博文、視頻（搭建或使用有問題可以先去裡面學習哦~）</summary>


**體驗地址**：[CloudFlare ImgBed](https://cfbed.1314883.xyz/)

> 訪問碼：cfbed

**體驗視頻**：[CloudFlare免費圖床，輕鬆守護你的每一份精彩！_哔哩哔哩_bilibili](https://www.bilibili.com/video/BV1y3WGe4EGh/?vd_source=da5ecbe595e41089cd1bed95932b8bfd)

**相關教程視頻**：

- [利用Cloudflare R2 +Pages搭建在線圖床系統，不限空間，不被牆，超級簡單，完全免費 (youtube.com)](https://www.youtube.com/watch?v=T8VayuUMOzM)

**相關優質博文（感謝每一位鼎力支持的熱心大佬）：**

- [CloudFlare-ImgBed項目 – yunsen2025的小窩](https://www.yunsen2025.top/category/cloudflare-imgbed/)
  - [完全免費，圖文教程手把手教你使用cloudflare搭建一個無限空間的私人圖床 支持身份認證與成人元素鑑定！ - yunsen2025的小窩](https://www.yunsen2025.top/blog-cfpages-syq-imgbed)
  - [為CloudFlare-ImgBed圖床配置國內CDN並分線路解析，以最低成本享受極致速度！ – yunsen2025的小窩](https://www.yunsen2025.top/cloudflare-imgbed-fen-xian-pei-zhi-guo-nei-cdn/)
- [利用cloudflare pages搭建telegram頻道圖床 (lepidus.me)](https://blogstr.lepidus.me/post/1725801323700/)
- [搭建基於CloudFlare和Telegram的免費圖床教程 - 劉學館 | Blog (sexy0769.com)](https://blog.sexy0769.com/skill/735.html)
- [CloudFlare+Github，打造屬於自己的免費圖床 - 大頭釘的小小blog (luckyting.top)](https://luckyting.top/index.php/archives/20/)

</details>



## 最近更新

Add Features:

- 美化報錯圖片
- 上傳頁面支持預覽ico等更多格式文件



<details>
    <summary>更新日誌</summary>


## 2025.6.13

Add Features:

- 美化報錯圖片
- 上傳頁面支持預覽ico等更多格式文件

## 2025.6.12

Add Features:

- `upload`接口支持跨域訪問和調用

Fix Bugs:

- 修復`list`接口返回數據完整性的问题

## 2025.5.23

Add Features:

- 增加公告功能

Fix Bugs:

- 修復後台圖片名過長遮蓋圖片的問題
- 優化部分頁面顯示效果
- 修復 Docker 鏡像無法訪問 https 外鏈的問題

## 2025.5.11

Add Features:

- 支持通過Docker在服務器上部署

## 2025.3.14

Add Features:

- 上傳用戶管理支持顯示IP具體位置

## 2025.3.8

Add Features:

- 隨機圖API支持按目錄讀取，支持按目錄進行權限控制

Fix Bugs:

- 修復隨機圖API的緩存問題

## 2025.3.7

Add Features:

- **目錄功能上線啦**，當前支持：
  - 上傳到指定目錄
  - 整目錄刪除
  - 文件位置移動（ Telegraph 和舊版 Telegram 渠道不支持移動）
  - 按目錄讀取文件
- 隨機圖API支持按目錄讀取

Fix Bugs:

- 修復多項影響體驗的bug

## 2025.3.1

Add Features:

- 支持粘貼多個鏈接同時上傳
- 支持存儲和管理外鏈

Fix Bugs:

- 修復管理端複製 S3 鏈接的有關問題
- 修復管理端部分頁面設置不生效的問題
- 修復渠道設置某些情況下不能保存的問題

## 2025.2.6

**v2.0版本煥新登場**，帶來多項新功能和優化，給您煥然一新的用戶體驗：

💪**更強大**：

- 接入 S3 API 渠道，支持 Cloudflare R2 , Backblaze B2 ，七牛雲，又拍雲等多個服務商的對象存儲服務
- 支持設置多個 Telegram 和 S3 渠道，支持多渠道負載均衡
- 上傳文件支持短鏈接命名方式

✈️**更高效**：

- 全部設置項遷移到管理端系統設置界面，無需進行環境變量的繁瑣配置，立即設置立即生效
- 管理端 Gallery 和 用戶管理 等頁面實現分頁讀取，提升前端渲染速度，優化使用體驗
- 支持禁用、啟用渠道，渠道管理自在掌握
- 多個設置項加入提示彈窗，不用到處翻閱文檔，設置更踏實

✨**更精緻**：

- 全局支持深色模式，根據用戶喜好和時間自動切換，凸顯滿滿高級感
- 登錄頁面、圖庫頁面、用戶管理頁面等多個頁面細節重新打磨，操作更直觀
- 上傳頁全新 Tab 欄，一拉一合，靈動又便捷
- Logo 煥新，純手工打造，能力有限，不喜勿噴（
- 支持自定義隱藏頁腳，強迫症患者有救啦

## 2024.12.27

Add Features:

- 支持通過環境變量自定義全局默認鏈接前綴（見3.1.3.6自定義配置接口）
- 管理端支持自定義鏈接前綴
- 管理端部分頁面展示效果優化
- `/upload`API支持返回完整鏈接（請求時設置`returnFormat`參數，詳見API文檔）

Fix Bugs:

- 優化上傳頁面顯示效果

## 2024.12.20

Add Features:

- 管理端支持拉黑上傳IP（Dashboard->用戶管理->允許上傳）
- 管理端批量操作支持按照用戶選擇的順序進行（[#issue124](https://github.com/MarSeventh/CloudFlare-ImgBed/issues/124)）
- `random`接口優化，減少KV操作次數，增加`content`參數，支持返回指定類型的文件
- 接入CloudFlare Cache API，提升 list 相關接口訪問速度
- 正常讀取返回圖片的CDN緩存時間從1年調整為7天，防止緩存清除不成功的情況下圖片長時間內仍可以訪問的問題

## 2024.12.14

Add Features:

- 管理端增加批量黑名單、白名單功能

## 2024.12.13

Add Features:

- 優化blockimg、whitelistmode、404等返回狀態的緩存策略，儘可能減少回源請求(參考文檔`3.1.3.9管理端刪除、拉黑等操作優化`進行設置)

## 2024.12.12

Add Features: 

- 後端支持上傳失敗自動切換其他渠道重試
- 優化404、blockimg、whitelistmode等返回狀態的顯示樣式

## 2024.12.11

Add Features:

- 進行刪除、加入白名單、加入黑名單等操作時，自動清除CF CDN緩存，避免延遲生效(參考文檔`3.1.3.9管理端刪除、拉黑等操作優化`進行設置)

## 2024.12.10

Add Features:

- 文件詳情增加文件大小記錄

## 2024.12.09

Add Features:

- 開放更多文件格式

Fix Bugs:

- 讀取文件響應頭增加允許跨域頭`access-control-allow-origin: *`

## 2024.12.04

Add Features:

- 支持自定義命名方式（僅原名 or 僅隨機前綴 or 默認的隨機前綴_原名）
- Telegram Channel渠道上傳文件記錄機器人和頻道數據，便於遷移和備份
- 支持自定義鏈接前綴

Fix Bugs:

- R2渠道在管理端刪除時，存儲桶同步刪除

## 2024.11.05

Add Features:

- 增加對R2 bucket的支持

## 2024.10.20

Add Features:

- 頁腳增加自定義傳送門功能

## 2024.09.28

Add Features:

- 上傳頁面右下角工具欄樣式重構，支持上傳頁自定義壓縮（上傳前+存儲端）
- 增加僅刪除上傳成功圖片、上傳失敗圖片重試

## 2024.09.27

Add Features:

- 上傳頁面點擊鏈接時，自動複製到剪切板
- 上傳設置記憶（上傳方式、鏈接格式等）

Fix Bugs:

- 若未設置密碼，無需跳轉登錄頁

## 2024.09.26

Add Features:

- 優化粘貼上傳時的文件命名方法

## 2024.09.12

Add Features:

- 增加背景透明度支持自定義

## 2024.09.11

Add Features:

- 支持背景切換時間自定義

## 2024.08.26

Add Features:

- 支持大於5MB的圖片上傳前自動壓縮
- 圖床名稱和Logo支持自定義
- 網站標題和Icon支持自定義

## 2024.08.23

Add Features:

- 支持URL粘貼上傳

## 2024.08.21

Add Features:

- 完善多格式鏈接展示形式，增加UBB格式鏈接支持
- 完善登錄邏輯，後端增加認證碼校驗接口

## 2024.07.25

Add Features:

- 增加隨機圖API

Fix Bugs:

- 修復API上傳無法直接展示在後台的問題

## 2024.07.22

Add Features:

- 增加粘貼圖片上傳功能

## 2024.07.21

Add Features:

- 增加Markdown、HTML等格式鏈接複製功能
- 上傳頁面增加管理端入口

</details>

# 1.Introduction

免費文件托管解決方案，具有**上傳**、**管理**、**讀取**、**刪除**等