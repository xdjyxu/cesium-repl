import type { Ref } from 'vue'
import type { CompileState } from './compileService/common/protocol'
import type { SandcastleShareData } from './shareService/common/protocol'
import { filter } from 'rxjs'
import { useCompile } from './useCompile'
import { useLockService } from './lockService/common/useLockService'
import { useProfileService } from './profileService/browser/useProfileService'

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
   * @deprecated 请直接从 ArtifactService 的 artifact$ 获取
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
 * 若 profile.autoCompile 为 true，则在每次文件保存后也会自动触发编译。
 *
 * 编译源：从 FileService 读取已保存的文件内容（未保存的编辑不会被编译）。
 *
 * @param fsLoading - 文件系统加载状态（来自 useExampleLoader 的 state.loading）
 *
 * @example
 * ```vue
 * <script setup>
 * const exampleLoader = useExampleLoader()
 * const { compileState, compile } = useAutoCompile(
 *   computed(() => exampleLoader.state.loading)
 * )
 * </script>
 * ```
 */
export function useAutoCompile(fsLoading: Ref<boolean>): AutoCompileResult {
  const { compile, compileState } = useCompile()
  const lockService = useLockService()
  const profileService = useProfileService()

  // 兼容旧 API（已无消费者，保留类型兼容）
  const compiledCode = ref<SandcastleShareData | null>(null)

  // 监听 fsLoading 状态变化：加载完成后自动编译
  watch(fsLoading, async (loading, prevLoading) => {
    if (prevLoading === true && loading === false) {
      await compile()
    }
  })

  // 监听文件保存事件（lockChange$ type === 'clean'），autoCompile 启用时自动编译
  onMounted(() => {
    const sub = lockService.lockChange$
      .pipe(filter(event => event.type === 'clean'))
      .subscribe(async () => {
        if (!fsLoading.value && profileService.getProfile().autoCompile) {
          await compile()
        }
      })
    onUnmounted(() => sub.unsubscribe())
  })

  return {
    compileState,
    compiledCode,
    compile,
  }
}
