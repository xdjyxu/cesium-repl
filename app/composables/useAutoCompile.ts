import type { Ref } from 'vue'
import type { CompileState } from './compileService/common/protocol'
import type { SandcastleShareData } from './shareService/common/protocol'
import { useObservable } from '@vueuse/rxjs'
import { cssInline } from './compileService/browser/css-inline-plugin'
import { swcWasm } from './compileService/browser/swc-wasm-plugin'
import { useCompileService } from './compileService/browser/useCompileService'
import { useFileService } from './fileService/common/useFileService'

/**
 * 自动编译结果
 */
export interface AutoCompileResult {
  /**
   * 编译状态（响应式）
   */
  compileState: Ref<CompileState | undefined>

  /**
   * 编译后的代码（响应式）
   * 包含 main.js 和 index.html 的内容
   */
  compiledCode: Ref<SandcastleShareData | null>

  /**
   * 手动触发编译
   */
  compile: () => Promise<void>
}

/**
 * Replace `<link rel="stylesheet" href="...">` tags in HTML with inline `<style>` blocks.
 * Remote URLs (http/https/protocol-relative) are left untouched.
 */
async function inlineCssLinks(
  html: string,
  loadFile: (path: string) => Promise<string>,
): Promise<string> {
  // Matches both attribute orderings: rel before href and href before rel
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi
  const matches = [...html.matchAll(linkRe)]

  let result = html
  for (const match of matches) {
    const tag = match[0]
    const hrefMatch = tag.match(/href=["']([^"']+)["']/)
    if (!hrefMatch)
      continue

    const href = hrefMatch[1]
    if (!href)
      continue

    // Skip remote URLs
    if (/^(?:https?:)?\/\//i.test(href))
      continue

    // Normalize to absolute path for fileService
    const absolutePath = href.startsWith('/') ? href : `/${href}`

    try {
      const css = await loadFile(absolutePath)
      result = result.replace(tag, `<style>\n${css}\n</style>`)
    }
    catch {
      // File not found — keep the original tag
    }
  }

  return result
}

/**
 * 自动编译组合式函数
 *
 * 监听文件加载状态，当加载完成后自动触发编译。
 * 编译输出固定的 main.js 和 index.html，供 ShareService 使用。
 *
 * CSS 处理：
 * - JS/TS 中 `import './foo.css'` 的样式会被收集并注入到 HTML `<head>` 内
 * - HTML 中的 `<link rel="stylesheet" href="...">` 会被替换为内联 `<style>` 块
 *
 * @param fsLoading - 文件系统加载状态（来自 useExampleLoader 的 state.loading）
 *
 * @example
 * ```vue
 * <script setup>
 * const exampleLoader = useExampleLoader()
 * const { compileState, compiledCode } = useAutoCompile(
 *   computed(() => exampleLoader.state.loading)
 * )
 * </script>
 * ```
 */
export function useAutoCompile(fsLoading: Ref<boolean>): AutoCompileResult {
  const compileService = useCompileService()
  const fileService = useFileService()

  // 订阅编译状态
  const compileState = useObservable(compileService.state$)

  // 编译后的代码
  const compiledCode = ref<SandcastleShareData | null>(null)

  /**
   * 执行编译
   */
  async function compile() {
    try {
      // 获取 index.html 的内容
      let htmlContent = ''
      try {
        htmlContent = await fileService.readFile('/index.html', { encoding: 'utf8' })
      }
      catch {
        // 文件不存在时忽略
      }

      // CSS plugin — must come before fs-loader so its load() wins for .css files
      const cssPlugin = cssInline(async (id) => {
        try {
          return await fileService.readFile(id, { encoding: 'utf8' })
        }
        catch {
          return null
        }
      })

      // 配置 Rollup 编译选项
      const rollupOptions = {
        input: '/main.js',
        fs: fileService,
        external: ['cesium', 'Sandcastle'],
        plugins: [
          cssPlugin,
          // 文件加载插件：从 fileService 读取文件内容
          {
            name: 'fs-loader',
            resolveId(source: string) {
              if (source === '/main.js' || source.startsWith('/')) {
                return source
              }
              return { id: source, external: true }
            },
            async load(id: string) {
              try {
                return await fileService.readFile(id, { encoding: 'utf8' })
              }
              catch {
                return null
              }
            },
          },
          // SWC 编译插件
          swcWasm(),
        ],
        output: {
          format: 'iife' as const,
          name: 'CesiumApp',
          // 将外部模块映射到全局变量，使 IIFE 正确引用 CDN 加载的全局对象
          globals: {
            cesium: 'Cesium',
            Cesium: 'Cesium',
            Sandcastle: 'Sandcastle',
          },
        },
      }

      // 执行编译
      const result = await compileService.compile(rollupOptions)

      // 提取编译后的代码
      if (result?.[0]?.output?.[0]) {
        const output = result[0].output[0]
        const compiledJs = 'code' in output ? output.code : ''

        // 1. Inline <link rel="stylesheet"> in HTML
        let processedHtml = await inlineCssLinks(
          htmlContent,
          path => fileService.readFile(path, { encoding: 'utf8' }),
        )

        // 2. Append CSS collected from JS/TS imports
        const collectedCss = cssPlugin.getCollectedCss()
        if (collectedCss) {
          const styleTag = `<style>\n${collectedCss}\n</style>`
          processedHtml = processedHtml.includes('</head>')
            ? processedHtml.replace('</head>', `${styleTag}\n</head>`)
            : `${processedHtml}\n${styleTag}`
        }

        // 更新编译结果
        compiledCode.value = {
          code: compiledJs,
          html: processedHtml,
        }
      }
    }
    catch (error) {
      console.error('Compilation failed:', error)
      compiledCode.value = null
    }
  }

  // 监听 fsLoading 状态变化
  // 当从 true 变为 false 时（加载完成），触发编译
  watch(fsLoading, async (loading, prevLoading) => {
    if (prevLoading === true && loading === false) {
      // 加载完成，触发编译
      await compile()
    }
  })

  return {
    compileState,
    compiledCode,
    compile,
  }
}
