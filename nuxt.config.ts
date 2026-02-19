// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { viteStaticCopy } from 'vite-plugin-static-copy'

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
  vite: {
    plugins: [
      nodePolyfills({
        // 为 memfs 提供必要的 Node.js polyfills
        // 即使不使用流式 API，Volume 类定义时也会引用这些模块
        include: ['path', 'buffer', 'stream', 'util', 'events'],
      }),
      viteStaticCopy({
        targets: [
          {
            src: resolve(rootDir, 'node_modules/monaco-editor/min/vs/**/*'),
            dest: 'lib/monaco-editor/vs',
          },
        ],
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
