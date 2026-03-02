// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const MONACO_BASE_PATH = '/lib/monaco-editor/vs'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@unocss/nuxt', '@nuxt/content'],
  experimental: {
    decorators: true,
  },
  imports: {
    dirs: [
      'composables',
      'composables/*/common',
      'composables/*/browser',
      // node/ is intentionally excluded from auto-imports (only used in server plugins)
    ],
  },
  content: {
    build: {
      transformers: [
        '~~/transformers/example-folder',
        '~~/transformers/example-file',
      ],
    },
  },
  app: {
    head: {
      link: [
        // Monaco Editor CSS 将由 @monaco-editor/loader 动态加载
      ],
      // Cesium 在 sandcastle 页面动态加载
    },
  },
  // 禁用 SSR - Cesium REPL 是纯客户端应用
  // ssr: false,
  nitro: {
    // Monaco Editor 静态资源通过 nitro.publicAssets 提供，而非 vite-plugin-static-copy。
    // 原因：viteStaticCopy 在 dev 模式下会在启动时把所有文件复制一遍（buildStart hook），
    // 在 Windows（NTFS + Defender 实时扫描）下会导致 dev server 卡死在 @nuxt/content 初始化之后。
    // nitro.publicAssets 在 dev 下直接从 node_modules 按需提供文件（无任何复制开销），
    // build 时才将文件复制到输出目录，行为与 viteStaticCopy 完全等价。
    publicAssets: [
      {
        baseURL: '/lib/monaco-editor/vs',
        dir: resolve(rootDir, 'node_modules/monaco-editor/min/vs'),
        maxAge: 60 * 60 * 24 * 365,
      },
      {
        baseURL: '/lib/cesium',
        dir: resolve(rootDir, 'node_modules/cesium/Build/CesiumUnminified'),
        maxAge: 60 * 60 * 24 * 365,
      },
    ],
  },
  sourcemap: true,
  vite: {
    plugins: [
      nodePolyfills({
        // 为 memfs 提供必要的 Node.js polyfills
        // 即使不使用流式 API，Volume 类定义时也会引用这些模块
        include: ['path', 'buffer', 'stream', 'util', 'events'],
      }),
    ],
    build: {
      // 减少内存使用
      rollupOptions: {
        output: {
          // 手动分块以减少单个文件大小
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@rollup/browser')) {
                return 'rollup'
              }
              if (id.includes('@swc/wasm-web')) {
                return 'swc'
              }
              // 其他 node_modules 拆分为 vendor
              return 'vendor'
            }
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['@rollup/browser', '@swc/wasm-web', 'cesium', 'monaco-editor'],
    },
    define: {
      __MONACO_BASE_PATH__: JSON.stringify(MONACO_BASE_PATH),
    },
  },
})
