import type { Ref } from 'vue'
import type { CompileState } from './compileService/common/protocol'
import type { SandcastleShareData } from './shareService/common/protocol'
import { useObservable } from '@vueuse/rxjs'
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
 * 自动编译组合式函数
 *
 * 监听文件加载状态，当加载完成后自动触发编译。
 * 编译输出固定的 main.js 和 index.html，供 ShareService 使用。
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

      // 配置 Rollup 编译选项
      const rollupOptions = {
        input: '/main.js',
        fs: fileService,
        plugins: [
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
        },
      }

      // 执行编译
      const result = await compileService.compile(rollupOptions)

      // 提取编译后的代码
      if (result?.[0]?.output?.[0]) {
        const output = result[0].output[0]
        const compiledJs = 'code' in output ? output.code : ''

        // 更新编译结果
        compiledCode.value = {
          code: compiledJs,
          html: htmlContent,
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
