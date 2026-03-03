<script setup lang="ts">
import { useObservable } from '@vueuse/rxjs'

/**
 * 文件树节点
 */
interface TreeNode {
  name: string
  /** 文件完整路径（仅 file 节点有意义） */
  path: string
  /** 目录的唯一 key，用于展开状态追踪 */
  dirKey: string
  isDirectory: boolean
  children: TreeNode[]
}

/**
 * 扁平化渲染节点（用于 v-for 渲染）
 */
interface FlatNode {
  name: string
  path: string
  dirKey: string
  isDirectory: boolean
  depth: number
}

const emit = defineEmits<{
  selectFile: [path: string]
}>()

const editorService = useEditorService()
const tabService = useTabService()

const filePaths = useObservable<string[], string[]>(editorService.files$, { initialValue: [] as string[] })
const activeFilePath = useObservable<string | null, string | null>(tabService.activeTab$, { initialValue: null })

/** 目录展开状态：key 为 dirKey，value 为是否展开 */
const expandedDirs = reactive<Record<string, boolean>>({})

/**
 * 从文件路径列表构建树结构
 */
function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []
  const dirMap = new Map<string, TreeNode>()

  for (const filePath of paths) {
    // 规范化路径：去掉开头的 /
    const normalized = filePath.replace(/^\/+/, '')
    const parts = normalized.split('/').filter((s): s is string => s.length > 0)

    if (parts.length === 0)
      continue

    const fileName = parts.at(-1)
    if (!fileName)
      continue

    let currentChildren = root
    let currentDirKey = ''

    // 创建中间目录节点（路径中除最后一段外的所有部分）
    for (const segment of parts.slice(0, -1)) {
      const dirKey = currentDirKey ? `${currentDirKey}/${segment}` : segment

      if (!dirMap.has(dirKey)) {
        // 默认展开
        if (!(dirKey in expandedDirs)) {
          expandedDirs[dirKey] = true
        }
        const dirNode: TreeNode = {
          name: segment,
          path: dirKey,
          dirKey,
          isDirectory: true,
          children: [],
        }
        dirMap.set(dirKey, dirNode)
        currentChildren.push(dirNode)
      }

      currentChildren = dirMap.get(dirKey)!.children
      currentDirKey = dirKey
    }

    // 添加文件节点
    currentChildren.push({
      name: fileName,
      path: filePath,
      dirKey: '',
      isDirectory: false,
      children: [],
    })
  }

  sortNodes(root)
  return root
}

/** 目录优先、同类按字母排序（递归） */
function sortNodes(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory)
      return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const node of nodes)
    sortNodes(node.children)
}

const tree = computed(() => buildTree(filePaths.value ?? []))

/**
 * 将树结构扁平化，过滤掉已折叠目录中的节点
 */
function flattenTree(nodes: TreeNode[], depth = 0): FlatNode[] {
  const result: FlatNode[] = []
  for (const node of nodes) {
    result.push({
      name: node.name,
      path: node.path,
      dirKey: node.dirKey,
      isDirectory: node.isDirectory,
      depth,
    })
    if (node.isDirectory && expandedDirs[node.dirKey] !== false) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

const flatTree = computed(() => flattenTree(tree.value))

function toggleDir(dirKey: string) {
  expandedDirs[dirKey] = !expandedDirs[dirKey]
}

function handleNodeClick(node: FlatNode) {
  if (node.isDirectory) {
    toggleDir(node.dirKey)
  }
  else {
    tabService.openTab(node.path)
    emit('selectFile', node.path)
  }
}

/** 默认激活 main.js 的逻辑由 useExampleLoader 负责，文件树只负责展示和交互 */

/**
 * 根据文件名返回对应的图标 class 和颜色
 */
function getFileIconClass(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'i-carbon-document text-blue-400'
    case 'js':
    case 'jsx':
      return 'i-carbon-document text-yellow-400'
    case 'html':
    case 'htm':
      return 'i-carbon-document text-orange-400'
    case 'css':
      return 'i-carbon-document text-sky-300'
    case 'json':
      return 'i-carbon-document text-yellow-300'
    case 'md':
      return 'i-carbon-document text-gray-500 dark:text-gray-300'
    default:
      return 'i-carbon-document text-gray-500 dark:text-gray-400'
  }
}
</script>

<template>
  <div class="h-full flex flex-col select-none overflow-hidden bg-white dark:bg-gray-900">
    <!-- 面板标题 -->
    <div class="h-9 flex shrink-0 items-center px-4">
      <span class="text-xs text-gray-500 font-semibold tracking-wider uppercase dark:text-gray-400">Explorer</span>
    </div>

    <!-- 文件树 -->
    <div class="flex-1 overflow-x-hidden overflow-y-auto">
      <!-- 空状态 -->
      <div
        v-if="flatTree.length === 0"
        class="px-4 py-3 text-xs text-gray-500 italic"
      >
        No files open
      </div>

      <!-- 树节点列表 -->
      <div
        v-for="node in flatTree"
        :key="node.isDirectory ? node.dirKey : node.path"
        class="h-[22px] flex cursor-pointer items-center gap-1 pr-2 text-[13px] transition-colors"
        :class="[
          node.isDirectory ? 'text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300',
          !node.isDirectory && activeFilePath === node.path
            ? 'bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-gray-100'
            : 'hover:bg-gray-200/60 dark:hover:bg-gray-700/60',
        ]"
        :style="{ paddingLeft: `${8 + node.depth * 16}px` }"
        @click="handleNodeClick(node)"
      >
        <!-- 目录：折叠/展开箭头 + 文件夹图标 -->
        <template v-if="node.isDirectory">
          <div
            class="shrink-0 text-gray-500 transition-transform dark:text-gray-400"
            :class="[
              expandedDirs[node.dirKey] !== false
                ? 'i-carbon-chevron-down'
                : 'i-carbon-chevron-right',
            ]"
          />
          <div
            class="shrink-0"
            :class="[
              expandedDirs[node.dirKey] !== false
                ? 'i-carbon-folder-open text-yellow-400'
                : 'i-carbon-folder text-yellow-400',
            ]"
          />
        </template>

        <!-- 文件：占位（对齐箭头宽度） + 文件图标 -->
        <template v-else>
          <div class="w-4 shrink-0" />
          <div
            class="shrink-0"
            :class="getFileIconClass(node.name)"
          />
        </template>

        <!-- 节点名称 -->
        <span class="min-w-0 truncate leading-none">{{ node.name }}</span>
      </div>
    </div>
  </div>
</template>
