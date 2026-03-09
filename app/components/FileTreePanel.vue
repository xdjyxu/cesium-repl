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
  /** 新建占位输入行 */
  isPending?: true
  pendingMode?: 'file' | 'directory'
}

/**
 * 新建操作的挂起状态
 */
interface PendingCreate {
  mode: 'file' | 'directory'
  /** 父目录的 dirKey，'' 表示根级别 */
  parentDir: string
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

/** 虚拟空目录（用于显示用户显式创建的、尚无文件的目录） */
const virtualDirs = reactive(new Set<string>())

/** 当前选中节点的路径（目录用 dirKey，文件用 path） */
const selectedPath = ref<string | null>(null)
const selectedIsDir = ref(false)

/** 新建操作的挂起状态 */
const pendingCreate = ref<PendingCreate | null>(null)
const pendingName = ref('')
/** v-for 内的 ref 会是数组 */
const pendingInputRef = ref<HTMLInputElement[]>([])

/**
 * 确保 dirKey 对应的目录节点存在（递归创建父级），返回该节点
 */
function getOrCreateDir(dirKey: string, root: TreeNode[], dirMap: Map<string, TreeNode>): TreeNode {
  if (dirMap.has(dirKey))
    return dirMap.get(dirKey)!

  const parts = dirKey.split('/')
  const segment = parts.at(-1)!
  const parentKey = parts.slice(0, -1).join('/')

  if (!(dirKey in expandedDirs))
    expandedDirs[dirKey] = true

  const node: TreeNode = { name: segment, path: dirKey, dirKey, isDirectory: true, children: [] }
  dirMap.set(dirKey, node)

  if (parentKey) {
    getOrCreateDir(parentKey, root, dirMap).children.push(node)
  }
  else {
    root.push(node)
  }

  return node
}

/**
 * 从文件路径列表构建树结构（含虚拟空目录）
 */
function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []
  const dirMap = new Map<string, TreeNode>()

  // 先处理虚拟空目录
  for (const vDir of virtualDirs) {
    getOrCreateDir(vDir, root, dirMap)
  }

  // 处理真实文件路径
  for (const filePath of paths) {
    const normalized = filePath.replace(/^\/+/, '')
    const parts = normalized.split('/').filter((s): s is string => s.length > 0)

    if (parts.length === 0)
      continue

    const fileName = parts.at(-1)
    if (!fileName)
      continue

    const parentDirKey = parts.slice(0, -1).join('/')
    const targetChildren = parentDirKey
      ? getOrCreateDir(parentDirKey, root, dirMap).children
      : root

    targetChildren.push({
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
 * 将树结构扁平化，过滤掉已折叠目录中的节点，
 * 并在对应父目录末尾插入 pending 输入行
 */
function flattenTree(nodes: TreeNode[], depth = 0, parentDirKey = ''): FlatNode[] {
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
      result.push(...flattenTree(node.children, depth + 1, node.dirKey))
    }
  }

  // 在当前目录层末尾追加 pending 输入行
  if (pendingCreate.value?.parentDir === parentDirKey) {
    result.push({
      name: '',
      path: '',
      dirKey: '',
      isDirectory: pendingCreate.value.mode === 'directory',
      depth,
      isPending: true,
      pendingMode: pendingCreate.value.mode,
    })
  }

  return result
}

const flatTree = computed(() => flattenTree(tree.value, 0, ''))

function toggleDir(dirKey: string) {
  expandedDirs[dirKey] = !expandedDirs[dirKey]
}

function handleNodeClick(node: FlatNode) {
  if (node.isPending)
    return

  selectedPath.value = node.isDirectory ? node.dirKey : node.path
  selectedIsDir.value = node.isDirectory

  if (node.isDirectory) {
    toggleDir(node.dirKey)
  }
  else {
    tabService.openTab(node.path)
    emit('selectFile', node.path)
  }
}

function isSelected(node: FlatNode): boolean {
  if (node.isDirectory)
    return selectedIsDir.value && selectedPath.value === node.dirKey
  return !selectedIsDir.value && selectedPath.value === node.path
}

/**
 * 根据当前选中节点计算新建条目的父目录
 */
function getParentDirForCreate(): string {
  if (!selectedPath.value)
    return ''

  if (selectedIsDir.value) {
    return selectedPath.value
  }
  else {
    const normalized = selectedPath.value.replace(/^\/+/, '')
    const parts = normalized.split('/')
    return parts.slice(0, -1).join('/')
  }
}

async function startCreate(mode: 'file' | 'directory') {
  const parentDir = getParentDirForCreate()
  // 确保父目录处于展开状态
  if (parentDir)
    expandedDirs[parentDir] = true

  pendingCreate.value = { mode, parentDir }
  pendingName.value = ''
  await nextTick()
  pendingInputRef.value[0]?.focus()
}

async function confirmCreate() {
  const name = pendingName.value.trim()
  if (!name || !pendingCreate.value) {
    cancelCreate()
    return
  }

  const { mode, parentDir } = pendingCreate.value
  const fullPath = parentDir ? `/${parentDir}/${name}` : `/${name}`
  const dirKey = parentDir ? `${parentDir}/${name}` : name

  pendingCreate.value = null
  pendingName.value = ''

  if (mode === 'file') {
    await editorService.createOrGetModel(fullPath, '')
    tabService.openTab(fullPath)
    emit('selectFile', fullPath)
    selectedPath.value = fullPath
    selectedIsDir.value = false
  }
  else {
    virtualDirs.add(dirKey)
    if (!(dirKey in expandedDirs))
      expandedDirs[dirKey] = true
    selectedPath.value = dirKey
    selectedIsDir.value = true
  }
}

function cancelCreate() {
  pendingCreate.value = null
  pendingName.value = ''
}

function deleteSelected() {
  if (!selectedPath.value)
    return

  if (!selectedIsDir.value) {
    const path = selectedPath.value
    editorService.deleteModel(path)
    tabService.closeTab(path)
  }
  else {
    const dirKey = selectedPath.value
    const prefix = `${dirKey}/`
    const paths = filePaths.value ?? []

    for (const p of paths) {
      const normalized = p.replace(/^\/+/, '')
      if (normalized === dirKey || normalized.startsWith(prefix)) {
        editorService.deleteModel(p)
        tabService.closeTab(p)
      }
    }

    // 同步清理虚拟目录
    for (const vDir of [...virtualDirs]) {
      if (vDir === dirKey || vDir.startsWith(prefix))
        virtualDirs.delete(vDir)
    }
  }

  selectedPath.value = null
  selectedIsDir.value = false
}

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
    <!-- 面板标题 + 操作按钮 -->
    <div class="h-9 flex shrink-0 items-center border-b border-gray-200 dark:border-gray-700/60">
      <span class="flex-1 px-4 text-xs text-gray-500 font-semibold tracking-wider uppercase dark:text-gray-400">Explorer</span>
      <div class="flex items-center gap-0.5 px-1">
        <!-- 新建目录 -->
        <button
          class="h-6 w-6 flex cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          title="New Folder"
          @click="startCreate('directory')"
        >
          <div class="i-carbon-folder-add text-base" />
        </button>
        <!-- 新建文件 -->
        <button
          class="h-6 w-6 flex cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          title="New File"
          @click="startCreate('file')"
        >
          <div class="i-carbon-document-add text-base" />
        </button>
        <!-- 删除 -->
        <button
          class="h-6 w-6 flex items-center justify-center rounded"
          :class="selectedPath
            ? 'cursor-pointer text-gray-500 hover:bg-gray-200 hover:text-red-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400'
            : 'cursor-not-allowed text-gray-300 dark:text-gray-600'"
          :disabled="!selectedPath"
          title="Delete"
          @click="deleteSelected"
        >
          <div class="i-carbon-trash-can text-base" />
        </button>
      </div>
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
      <template
        v-for="node in flatTree"
        :key="node.isPending ? '__pending__' : (node.isDirectory ? node.dirKey : node.path)"
      >
        <!-- 新建名称输入行 -->
        <div
          v-if="node.isPending"
          class="h-[22px] flex items-center gap-1 pr-2"
          :style="{ paddingLeft: `${8 + node.depth * 16}px` }"
        >
          <div class="w-4 shrink-0" />
          <div
            class="shrink-0"
            :class="node.pendingMode === 'directory'
              ? 'i-carbon-folder text-yellow-400'
              : 'i-carbon-document text-gray-400 dark:text-gray-500'"
          />
          <input
            ref="pendingInputRef"
            v-model="pendingName"
            class="min-w-0 flex-1 border border-blue-500 rounded bg-transparent px-1 text-[13px] text-gray-800 leading-none outline-none dark:text-gray-200"
            placeholder="Name…"
            @keydown.enter="confirmCreate"
            @keydown.escape="cancelCreate"
            @blur="cancelCreate"
          >
        </div>

        <!-- 普通树节点 -->
        <div
          v-else
          class="h-[22px] flex cursor-pointer items-center gap-1 pr-2 text-[13px] transition-colors"
          :class="[
            node.isDirectory ? 'text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300',
            !node.isDirectory && activeFilePath === node.path
              ? 'bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-gray-100'
              : isSelected(node)
                ? 'bg-gray-100 dark:bg-gray-700/80'
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
      </template>
    </div>
  </div>
</template>
