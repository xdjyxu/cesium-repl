import type { DeepReadonly, Ref } from 'vue'
import type { SandcastleShareData } from './shareService/common/protocol'
import { useEditorService } from './editorService/browser/useEditorService'
import { useFileService } from './fileService/common/useFileService'
import { useShareService } from './shareService/common/useShareService'
import { useTabService } from './tabService/common/useTabService'

/**
 * 示例文件信息
 */
export interface ExampleFile {
  path: string
  content: string
  language?: string
}

/**
 * 示例加载器状态
 */
export interface ExampleLoaderState {
  /**
   * 是否正在加载
   */
  loading: boolean

  /**
   * 当前加载的文件列表
   */
  files: ExampleFile[]

  /**
   * 错误信息
   */
  error: Error | null

  /**
   * 当前加载类型
   */
  type: 'internal' | 'external' | null
}

/**
 * 示例加载器统一返回值
 */
export interface ExampleLoaderReturn {
  /**
   * 加载器状态（响应式，只读）
   */
  state: DeepReadonly<ExampleLoaderState>

  /**
   * 当前示例数据（响应式，只读）
   * - type='internal': Nuxt Content 示例数据
   * - type='external': Sandcastle 分享数据
   */
  data: Readonly<Ref<any>>

  /**
   * 重新加载当前示例
   */
  reload: () => void

  /**
   * 清空所有文件
   */
  clear: () => Promise<void>

  /**
   * 加载 index 示例（New Sandcastle 模板）
   */
  loadIndex: () => Promise<void>
}

/**
 * 统一的示例加载器
 *
 * 根据 URL 参数自动选择加载方式：
 * - `/?id=XXX`: 加载内部示例
 * - `/#c=XXX`: 加载外部压缩代码（Sandcastle 格式）
 * - 无参数时：默认加载 'hello-world' 示例
 *
 * @example
 * ```vue
 * <script setup>
 * const { state, data, reload } = useExampleLoader()
 * // state.type 指示当前加载类型 ('internal' | 'external' | null)
 * // data 包含当前示例数据
 * </script>
 * ```
 */
/**
 * examples/index 默认模板文件（用于 New Sandcastle 初始化）
 */
const INDEX_TEMPLATE_FILES: ExampleFile[] = [
  {
    path: '/main.js',
    content: `import * as Cesium from 'cesium'\n\nconst viewer = new Cesium.Viewer('cesiumContainer')\n`,
    language: 'javascript',
  },
]

export function useExampleLoader(): ExampleLoaderReturn {
  const fileService = useFileService()
  const editorService = useEditorService()
  const shareService = useShareService()
  const tabService = useTabService()
  const route = useRoute()

  // 计算当前示例 ID 和类型
  const exampleId = computed(() => {
    // 优先检查 hash 中的压缩代码
    if (route.hash && route.hash.includes('#c=')) {
      return null // external 模式不需要 id
    }
    // 其次检查 query 参数
    if (route.query.id) {
      return String(route.query.id)
    }
    // 默认回退到 index
    return 'index'
  })

  const exampleType = computed((): 'internal' | 'external' | null => {
    // 优先检查 hash 中的压缩代码
    if (route.hash && route.hash.includes('#c=')) {
      return 'external'
    }
    // 如果有 id，则为 internal
    if (exampleId.value) {
      return 'internal'
    }
    return null
  })

  // Internal: 从 Nuxt Content 加载的示例数据
  const internalExample = useGallery(
    computed(() => exampleId.value || 'hello-world'),
  )

  // External: 从 URL hash 解压出的数据
  const externalData = ref<SandcastleShareData | null>(null)

  // 统一的数据接口
  const data = computed(() => {
    return exampleType.value === 'external' ? externalData.value : internalExample.value
  })

  // 加载器状态
  const state = reactive<ExampleLoaderState>({
    loading: false,
    files: [],
    error: null,
    type: null,
  })

  /**
   * 清空所有文件
   */
  async function clearAll() {
    // 关闭所有 Tab（强制，忽略锁定状态）
    tabService.closeAll()

    // 获取 editorService 当前追踪的所有文件（含用户在文件树手动创建的文件）
    const allPaths = editorService.getFiles()

    // 清空所有 Monaco 模型
    allPaths.forEach((path) => {
      editorService.deleteModel(path)
    })

    // 清空虚拟文件系统中的所有文件
    await Promise.all(
      allPaths.map(async (path) => {
        try {
          await fileService.unlink(path)
        }
        catch (err) {
          // 文件可能不存在，忽略错误
          console.warn(`Failed to delete file ${path}:`, err)
        }
      }),
    )

    state.files = []
  }

  /**
   * 加载示例文件
   */
  async function loadExampleFiles(files: ExampleFile[]) {
    state.loading = true
    state.error = null

    try {
      // 清空之前的文件
      await clearAll()

      // 并行创建所有文件的 Monaco 模型（不自动打开 Tab）
      await Promise.all(
        files.map(async (file) => {
          // 写入到虚拟文件系统
          await fileService.writeFile(file.path, file.content)

          // 创建 Monaco 编辑器模型（根据文件扩展名自动检测语言）
          await editorService.createOrGetModel(file.path, file.content)
        }),
      )

      // 更新状态
      state.files = [...files]

      // 默认激活 main.js，若不存在则激活第一个文件
      // openTab 会同时打开 Tab 并激活，只对默认文件调用
      const mainFile = files.find(f => /\/main\.[jt]sx?$/.test(f.path) || /^main\.[jt]sx?$/.test(f.path))
        ?? files[0]
      if (mainFile) {
        tabService.openTab(mainFile.path)
      }
    }
    catch (err) {
      state.error = err instanceof Error ? err : new Error(String(err))
      console.error('Failed to load example files:', err)
    }
    finally {
      state.loading = false
    }
  }

  /**
   * 从 URL hash 提取并解压数据
   */
  function extractFromUrl(url: string): SandcastleShareData | null {
    try {
      // 提取压缩字符串
      const compressed = shareService.extractFromSandcastleUrl(url)
      if (!compressed) {
        return null
      }

      // 解压缩
      const decompressed = shareService.decompress(compressed)
      return decompressed
    }
    catch (err) {
      console.error('Failed to extract and decompress from URL:', err)
      return null
    }
  }

  /**
   * 重新加载当前示例
   */
  function reload() {
    if (exampleType.value === 'external' && externalData.value) {
      // 加载外部示例
      const files: ExampleFile[] = [
        { path: '/main.js', content: externalData.value.code, language: 'javascript' },
        { path: '/index.html', content: externalData.value.html, language: 'html' },
      ]
      loadExampleFiles(files)
    }
    else if (exampleType.value === 'internal' && internalExample.value?.files) {
      // 加载内部示例
      loadExampleFiles(internalExample.value.files)
    }
  }

  // 监听 URL 变化，自动加载示例
  watch(
    [exampleType, () => route.hash, internalExample],
    async ([type, hash]) => {
      state.type = type

      if (type === 'external' && hash) {
        // 从 hash 提取并加载外部示例
        const extracted = extractFromUrl(hash)
        if (!extracted) {
          externalData.value = null
          await clearAll()
          return
        }

        externalData.value = extracted

        const files: ExampleFile[] = [
          { path: '/main.js', content: extracted.code, language: 'javascript' },
          { path: '/index.html', content: extracted.html, language: 'html' },
        ]

        await loadExampleFiles(files)
      }
      else if (type === 'internal' && internalExample.value?.files) {
        // 加载内部示例
        externalData.value = null
        await loadExampleFiles(internalExample.value.files)
      }
      else {
        // 清空
        externalData.value = null
        await clearAll()
      }
    },
    { immediate: true },
  )

  // 组件卸载时清理
  onUnmounted(() => {
    clearAll()
  })

  /**
   * 加载 index 示例（New Sandcastle 模板）
   * 优先使用已从 gallery 加载的数据，否则使用内置默认模板
   */
  async function loadIndex() {
    const files = internalExample.value?.files?.length
      ? internalExample.value.files
      : INDEX_TEMPLATE_FILES
    await loadExampleFiles(files)
  }

  return {
    /**
     * 加载器状态（响应式）
     */
    state: readonly(state),

    /**
     * 当前示例数据
     */
    data: data as Readonly<Ref<any>>,

    /**
     * 重新加载当前示例
     */
    reload,

    /**
     * 清空所有文件
     */
    clear: clearAll,

    /**
     * 加载 index 示例（New Sandcastle 模板）
     */
    loadIndex,
  }
}
