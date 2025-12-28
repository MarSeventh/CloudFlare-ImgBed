# 🎨 CloudFlare ImgBed 自定义美化方案

## 📁 文件结构

```
custom/
├── custom.css       # 自定义样式文件
├── custom.js        # 自定义脚本文件
└── README.md        # 使用说明（本文件）
```

## 🎯 美化特性

### 1. 视觉效果
- ✨ 现代渐变蓝紫色主题
- 🌈 动态背景效果
- 💎 毛玻璃（Glassmorphism）卡片设计
- 🎭 平滑过渡动画
- 📱 响应式设计优化

### 2. 组件美化
- 🔘 渐变按钮 + 悬停效果
- 📝 优化的输入框样式
- 🖼️ 图片预览动画
- 📜 自定义滚动条
- 🎨 统一的圆角和阴影

### 3. 交互增强
- 🚀 页面加载动画
- 👆 悬停交互效果
- 🎬 Vue 应用监听

## 🔧 使用方法

自定义样式已自动注入到 `index.html` 中：

```html
<!-- 自定义样式和脚本 -->
<link href="/custom/custom.css" rel="stylesheet">
<script defer src="/custom/custom.js"></script>
```

## 🎨 自定义配色

在 `custom.css` 中修改 CSS 变量即可更改配色：

```css
:root {
  --custom-primary: #667eea;        /* 主色调 */
  --custom-primary-light: #764ba2;  /* 主色调（浅色） */
  --custom-accent: #f093fb;         /* 强调色 */
}
```

## 🔄 保持上游更新的方法

### 方案一：使用 Git 远程仓库（推荐）

#### 1. 添加上游仓库
```bash
cd CloudFlare-ImgBed
git remote add upstream https://github.com/MarSeventh/CloudFlare-ImgBed.git
```

#### 2. 查看远程仓库
```bash
git remote -v
# origin    https://github.com/jmcgillcode/CloudFlare-ImgBed.git (你的 fork)
# upstream  https://github.com/MarSeventh/CloudFlare-ImgBed.git (原项目)
```

#### 3. 拉取上游更新
```bash
# 获取上游更新
git fetch upstream

# 合并到你的主分支
git checkout main
git merge upstream/main
```

#### 4. 解决冲突（如果有）
如果 `index.html` 有冲突，保留自定义部分：
```html
<!-- 自定义样式和脚本 -->
<link href="/custom/custom.css" rel="stylesheet">
<script defer src="/custom/custom.js"></script>
```

#### 5. 推送到你的仓库
```bash
git push origin main
```

### 方案二：使用自动化脚本

创建更新脚本 `update.sh`：
```bash
#!/bin/bash
echo "🔄 开始更新上游代码..."
git fetch upstream
git merge upstream/main
echo "✅ 更新完成！"
```

### 方案三：GitHub Actions 自动同步

在 `.github/workflows/sync.yml` 中配置自动同步（可选）。

## 📝 重要提示

### 需要保护的文件
更新时，以下文件包含自定义内容，需要特别注意：
- ✅ `index.html` - 已添加自定义脚本引用
- ✅ `custom/` 目录 - 所有自定义文件

### 更新后检查清单
- [ ] 确认 `index.html` 中的自定义引用还在
- [ ] 测试自定义样式是否正常加载
- [ ] 检查是否有新的冲突需要解决

## 🎯 快速开始

1. 克隆你的 fork 仓库
2. 自定义样式已经配置好，直接部署即可
3. 如需修改配色，编辑 `custom/custom.css`
4. 定期使用上述方法同步上游更新

## 💡 技巧

- 使用 Git 分支管理不同的主题风格
- 备份 `custom/` 目录以防意外
- 在本地测试后再推送到生产环境
