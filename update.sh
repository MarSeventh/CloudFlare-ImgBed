#!/bin/bash

# CloudFlare ImgBed 上游更新脚本
# 用于同步原项目的更新并保留自定义修改

echo "🔄 开始更新上游代码..."
echo ""

# 检查是否已添加上游仓库
if ! git remote | grep -q "upstream"; then
    echo "📌 添加上游仓库..."
    git remote add upstream https://github.com/MarSeventh/CloudFlare-ImgBed.git
    echo "✅ 上游仓库已添加"
else
    echo "✅ 上游仓库已存在"
fi

echo ""
echo "📥 获取上游更新..."
git fetch upstream

echo ""
echo "🔀 合并上游更新到当前分支..."
git merge upstream/main

echo ""
echo "✅ 更新完成！"
echo ""
echo "⚠️  请检查以下内容："
echo "  1. index.html 中的自定义引用是否还在"
echo "  2. custom/ 目录是否完整"
echo "  3. 是否有冲突需要解决"
echo ""
echo "💡 如果一切正常，使用以下命令推送到你的仓库："
echo "   git push origin main"
