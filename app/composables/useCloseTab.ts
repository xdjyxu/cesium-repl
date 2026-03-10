import { useLockService } from './lockService/common/useLockService'
import { useTabService } from './tabService/common/useTabService'

/**
 * 关闭 Tab 的用户选择
 */
export type CloseTabChoice = 'save' | 'discard' | 'cancel'

/**
 * 关闭 Tab 确认回调
 * @param path 文件路径
 * @returns 用户选择：'save' | 'discard' | 'cancel'
 */
export type CloseTabConfirmCallback = (path: string) => Promise<CloseTabChoice>

/**
 * Tab 关闭操作结果
 */
export interface CloseTabResult {
  /**
   * 尝试关闭 Tab（会检查锁定状态）
   * @param path 文件路径
   * @param onConfirm 当文件 dirty 时的确认回调
   * @returns 是否成功关闭
   */
  closeTab: (path: string, onConfirm?: CloseTabConfirmCallback) => Promise<boolean>

  /**
   * 判断 Tab 是否可以关闭（不考虑 dirty 状态）
   * @param path 文件路径
   */
  canClose: (path: string) => boolean
}

/**
 * Tab 关闭操作
 *
 * 处理关闭 Tab 时的锁定检查和用户确认逻辑：
 * - 如果 Tab 被 pinned，阻止关闭
 * - 如果 Tab 是 dirty，调用确认回调让用户选择保存/丢弃/取消
 *
 * @example
 * ```vue
 * <script setup>
 * const { closeTab, canClose } = useCloseTab()
 *
 * async function handleClose(path: string) {
 *   const closed = await closeTab(path, async (path) => {
 *     // 显示确认对话框
 *     const choice = await showConfirmDialog(path)
 *     return choice // 'save' | 'discard' | 'cancel'
 *   })
 *
 *   if (closed) {
 *     console.log('Tab closed')
 *   }
 * }
 * </script>
 * ```
 */
export function useCloseTab(): CloseTabResult {
  const tabService = useTabService()
  const lockService = useLockService()

  /**
   * 判断 Tab 是否可以关闭（不考虑 dirty 状态）
   */
  function canClose(path: string): boolean {
    return !lockService.isPinned(path)
  }

  /**
   * 尝试关闭 Tab
   */
  async function closeTab(
    path: string,
    onConfirm?: CloseTabConfirmCallback,
  ): Promise<boolean> {
    // 检查是否 pinned
    if (lockService.isPinned(path)) {
      return false
    }

    // 检查是否 dirty
    if (lockService.isDirty(path)) {
      if (!onConfirm) {
        // 没有提供确认回调，默认取消关闭
        return false
      }

      const choice = await onConfirm(path)

      if (choice === 'cancel') {
        return false
      }

      if (choice === 'save') {
        // 需要保存，但这里不直接保存
        // 由调用方在 onConfirm 回调中处理保存逻辑
        // 这里只是清除 dirty 状态
        lockService.setDirty(path, false)
      }

      // choice === 'discard' 时直接关闭
    }

    // 执行关闭
    tabService.closeTab(path)
    return true
  }

  return {
    closeTab,
    canClose,
  }
}
