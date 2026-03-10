import { useEditorService } from './editorService/browser/useEditorService'
import { useLockService } from './lockService/common/useLockService'

/**
 * 保存文件结果
 */
export interface SaveFileResult {
  /**
   * 保存指定文件
   * @param path 文件路径
   * @returns 保存是否成功
   */
  saveFile: (path: string) => Promise<boolean>

  /**
   * 保存所有 dirty 文件
   * @returns 保存的文件数量
   */
  saveAll: () => Promise<number>

  /**
   * 获取所有 dirty 文件路径
   */
  getDirtyFiles: () => string[]
}

/**
 * 文件保存操作
 *
 * 提供保存单个文件和保存所有文件的功能
 *
 * @example
 * ```vue
 * <script setup>
 * const { saveFile, saveAll, getDirtyFiles } = useSaveFile()
 *
 * // 保存当前文件
 * await saveFile('/main.ts')
 *
 * // 保存所有 dirty 文件
 * await saveAll()
 * </script>
 * ```
 */
export function useSaveFile(): SaveFileResult {
  const editorService = useEditorService()
  const lockService = useLockService()

  /**
   * 保存指定文件
   */
  async function saveFile(path: string): Promise<boolean> {
    return await editorService.saveModel(path)
  }

  /**
   * 保存所有 dirty 文件
   */
  async function saveAll(): Promise<number> {
    const dirtyFiles = getDirtyFiles()
    let savedCount = 0

    for (const path of dirtyFiles) {
      const success = await saveFile(path)
      if (success) {
        savedCount++
      }
    }

    return savedCount
  }

  /**
   * 获取所有 dirty 文件路径
   */
  function getDirtyFiles(): string[] {
    const lockStates = lockService.lockStates$.value
    const dirtyFiles: string[] = []

    lockStates.forEach((state) => {
      if (state.dirty) {
        dirtyFiles.push(state.path)
      }
    })

    return dirtyFiles
  }

  return {
    saveFile,
    saveAll,
    getDirtyFiles,
  }
}
