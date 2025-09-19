#!/bin/bash

# SonoScope 项目设置脚本
# 用于快速设置开发环境

set -e

echo "🎵 欢迎使用 SonoScope 项目设置脚本"
echo "=================================="

# 检查 Node.js 版本
echo "📋 检查环境要求..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 错误: Node.js 版本过低，需要 18+，当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 安装 pnpm..."
    npm install -g pnpm@8
else
    echo "✅ pnpm 版本: $(pnpm -v)"
fi

# 安装依赖
echo "📦 安装项目依赖..."
pnpm install

# 构建所有包
echo "🔨 构建所有包..."
pnpm build

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p app/public/assets
mkdir -p app/public/fonts
mkdir -p app/public/textures

# 检查浏览器兼容性
echo "🌐 检查浏览器兼容性..."
echo "请确保使用现代浏览器，支持以下功能："
echo "  - Web Audio API"
echo "  - WebGL"
echo "  - MediaDevices API"
echo "  - ES2022"

echo ""
echo "🎉 设置完成！"
echo "=================================="
echo "启动开发服务器: pnpm dev"
echo "构建生产版本: pnpm build"
echo "运行测试: pnpm test"
echo "代码检查: pnpm lint"
echo ""
echo "📚 更多信息请查看 README.md"
