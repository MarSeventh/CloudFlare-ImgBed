const { defineConfig } = require('@vue/cli-service');
const AutoImport = require('unplugin-auto-import/webpack').default
const Components = require('unplugin-vue-components/webpack').default
const { ElementPlusResolver } = require('unplugin-vue-components/resolvers');
const CompressionPlugin = require("compression-webpack-plugin")

module.exports = defineConfig({
  outputDir: '../dist', // 构建输出到父目录，与后端项目合并
  assetsDir: 'assets', // 静态资源目录
  configureWebpack: {
    plugins: [
      new CompressionPlugin(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
  },
  devServer: {
    port: 3000, // 前端开发服务器端口
    proxy: {
      '/api': {
        target: 'http://localhost:8080', // 代理到后端开发服务器
        changeOrigin: true,
        pathRewrite: {
          '^/api': '',
        },
      },
    },
  },
  transpileDependencies: true,
});
