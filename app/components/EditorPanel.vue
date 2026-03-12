<script setup lang="ts">
import type { FileLockState } from '~/composables/lockService/common/protocol'
import type { Tab } from '~/composables/tabService/common/protocol'
import type { CloseTabChoice } from '~/composables/useCloseTab'
import { useObservable } from '@vueuse/rxjs'

/**
 * 编辑器面板
 * 集成 Monaco Editor，Tab 状态由 TabService 和 LockService 共同管理
 */
const tabService = useTabService()
const lockService = useLockService()
const { closeTab } = useCloseTab()
const { saveFile, saveAll, getDirtyFiles } = useSaveFile()
const { compile } = useCompile()

const tabs = useObservable<Tab[], Tab[]>(tabService.tabs$, { initialValue: [] as Tab[] })
const activeFilePath = useObservable<string | null, string | null>(tabService.activeTab$, { initialValue: null })
const lockStates = useObservable<Map<string, FileLockState>, Map<string, FileLockState>>(lockService.lockStates$, { initialValue: new Map<string, FileLockState>() })

/** 从完整路径中取文件名 */
function getFileName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

/** 根据文件名返回 tab 顶部高亮色 class */
function getTabAccentClass(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'bg-blue-400'
    case 'js':
    case 'jsx':
      return 'bg-yellow-400'
    case 'html':
    case 'htm':
      return 'bg-orange-400'
    case 'css':
      return 'bg-sky-300'
    case 'json':
      return 'bg-yellow-300'
    default:
      return 'bg-gray-400'
  }
}

function isDirty(path: string): boolean {
  return lockStates.value.get(path)?.dirty ?? false
}

function isPinned(path: string): boolean {
  return lockStates.value.get(path)?.pinned ?? false
}

function handleTabClick(tab: Tab) {
  tabService.activateTab(tab.path)
}

function handleTogglePin(tab: Tab) {
  lockService.setPinned(tab.path, !isPinned(tab.path))
}

// --- 关闭确认对话框状态 ---
interface PendingClose {
  path: string
  resolve: (choice: CloseTabChoice) => void
}
const pendingClose = ref<PendingClose | null>(null)

function showConfirmDialog(path: string): Promise<CloseTabChoice> {
  return new Promise((resolve) => {
    pendingClose.value = { path, resolve }
  })
}

function handleConfirmChoice(choice: CloseTabChoice) {
  if (choice === 'save' && pendingClose.value) {
    const path = pendingClose.value.path
    saveFile(path).then(() => {
      pendingClose.value?.resolve('save')
      pendingClose.value = null
    })
    return
  }
  pendingClose.value?.resolve(choice)
  pendingClose.value = null
}

async function handleTabClose(tab: Tab) {
  await closeTab(tab.path, (path) => {
    return showConfirmDialog(path)
  })
}

// --- Run Sandcastle 按钮 ---
type RunDropdownChoice = 'save' | 'run' | 'cancel'

const showRunDropdown = ref(false)
const isRunning = ref(false)

/** 关闭运行下拉菜单 */
function closeRunDropdown() {
  showRunDropdown.value = false
}

/** 点击 Run Sandcastle 按钮 */
async function handleRunSandcastle() {
  const dirtyFiles = getDirtyFiles()
  if (dirtyFiles.length > 0) {
    showRunDropdown.value = true
  }
  else {
    await triggerCompile()
  }
}

/** 处理运行下拉菜单选项 */
async function handleRunChoice(choice: RunDropdownChoice) {
  closeRunDropdown()
  if (choice === 'cancel')
    return

  if (choice === 'save') {
    await saveAll()
  }

  await triggerCompile()
}

/** 触发编译 */
async function triggerCompile() {
  isRunning.value = true
  try {
    await compile()
  }
  finally {
    isRunning.value = false
  }
}

// 点击外部关闭下拉
function handleOutsideClick() {
  if (showRunDropdown.value) {
    closeRunDropdown()
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col bg-white dark:bg-gray-900">
    <!-- 文件标签栏 -->
    <div class="h-10 flex shrink-0 items-stretch border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
      <!-- Tab 列表（可滚动） -->
      <div class="min-w-0 flex flex-1 items-center overflow-x-auto">
        <div
          v-for="tab in tabs"
          :key="tab.path"
          class="group relative h-full flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-gray-200 pl-4 pr-2 text-sm transition-colors dark:border-gray-700"
          :class="[
            activeFilePath === tab.path
              ? 'bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100'
              : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200',
          ]"
          @click="handleTabClick(tab)"
        >
          <!-- 激活 tab 顶部高亮线 -->
          <div
            v-if="activeFilePath === tab.path"
            class="absolute inset-x-0 top-0 h-[2px]"
            :class="getTabAccentClass(getFileName(tab.path))"
          />

          <!-- 文件名 -->
          <span>{{ getFileName(tab.path) }}</span>

          <!-- 操作按钮区域 -->
          <div class="flex shrink-0 items-center">
            <!-- pinned 状态：显示 pin 图标，点击切换 -->
            <button
              v-if="isPinned(tab.path)"
              class="h-4 w-4 flex items-center justify-center rounded bg-transparent text-gray-400 transition-colors hover:bg-gray-300 dark:text-gray-500 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-300"
              title="Unpin tab"
              @click.stop="handleTogglePin(tab)"
            >
              <div class="i-carbon-pin-filled text-[11px]" />
            </button>

            <!-- 未 pinned：dirty 时显示圆点，hover 按钮后切换为关闭图标 -->
            <template v-else>
              <button
                class="group/btn h-4 w-4 flex items-center justify-center rounded bg-transparent transition-colors"
                :class="isDirty(tab.path)
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-transparent group-hover:text-gray-400 dark:group-hover:text-gray-500 hover:!bg-gray-300 dark:hover:!bg-gray-600 hover:!text-gray-700 dark:hover:!text-gray-300'"
                :title="isDirty(tab.path) ? 'Unsaved changes – click to close' : 'Close tab'"
                @click.stop="handleTabClose(tab)"
              >
                <!-- dirty：默认圆点，hover 按钮时隐藏 -->
                <span
                  v-if="isDirty(tab.path)"
                  class="h-2 w-2 rounded-full bg-current group-hover/btn:hidden"
                />
                <!-- dirty：hover 按钮时显示关闭图标，无背景 -->
                <div
                  v-if="isDirty(tab.path)"
                  class="i-carbon-close hidden text-[11px] group-hover/btn:block"
                />
                <!-- 非 dirty：正常关闭图标 -->
                <div
                  v-else
                  class="i-carbon-close text-[11px]"
                />
              </button>
            </template>
          </div>
        </div>

        <!-- 无 tab 时的占位 -->
        <div
          v-if="tabs?.length === 0"
          class="px-4 text-sm text-gray-400 italic dark:text-gray-600"
        >
          No files
        </div>
      </div>

      <!-- 右侧操作区 -->
      <div class="relative flex shrink-0 items-center border-l border-gray-200 px-2 dark:border-gray-700">
        <button
          class="h-6 flex items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors"
          :class="isRunning
            ? 'cursor-not-allowed bg-blue-400 text-white dark:bg-blue-600'
            : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'"
          :disabled="isRunning"
          title="Run Sandcastle"
          @click="handleRunSandcastle"
        >
          <div
            class="text-sm"
            :class="isRunning ? 'i-carbon-progress-bar animate-spin' : 'i-carbon-play'"
          />
          <span>Run</span>
        </button>

        <!-- 运行前确认下拉 -->
        <div
          v-if="showRunDropdown"
          class="absolute right-0 top-full z-50 mt-px w-52 border border-gray-200 rounded-md bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            有未保存的修改，是否保存后运行？
          </div>
          <div class="border-t border-gray-100 dark:border-gray-700">
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
              @click="handleRunChoice('save')"
            >
              <div class="i-carbon-save text-green-500" />
              保存并运行
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
              @click="handleRunChoice('run')"
            >
              <div class="i-carbon-play text-blue-500" />
              直接运行（不保存）
            </button>
            <button
              class="w-full flex items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-500 transition-colors dark:border-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50"
              @click="handleRunChoice('cancel')"
            >
              <div class="i-carbon-close text-gray-400" />
              取消
            </button>
          </div>
        </div>

        <!-- 点击外部关闭遮罩 -->
        <Teleport to="body">
          <div
            v-if="showRunDropdown"
            class="fixed inset-0 z-40"
            @click="handleOutsideClick"
          />
        </Teleport>
      </div>
    </div>

    <!-- Monaco Editor 容器 -->
    <div class="relative flex-1 overflow-hidden bg-white dark:bg-gray-900">
      <div
        v-if="!activeFilePath"
        class="h-full w-full flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-600"
      >
        <div class="i-carbon-code text-4xl" />
        <span class="text-sm">Select a file to edit</span>
      </div>
      <ClientOnly v-else>
        <MonacoEditor :active-file-path="activeFilePath" />
        <template #fallback>
          <div class="h-full w-full flex items-center justify-center text-gray-500">
            Loading editor...
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- 关闭确认对话框 -->
    <Teleport to="body">
      <div
        v-if="pendingClose"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="handleConfirmChoice('cancel')"
      >
        <div class="w-80 border border-gray-200 rounded-lg bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <p class="mb-1 text-sm text-gray-900 font-semibold dark:text-gray-100">
            Unsaved Changes
          </p>
          <p class="mb-5 text-sm text-gray-500 dark:text-gray-400">
            <span class="text-gray-700 font-medium dark:text-gray-300">{{ getFileName(pendingClose.path) }}</span>
            has unsaved changes. Save before closing?
          </p>
          <div class="flex justify-end gap-2">
            <button
              class="rounded px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              @click="handleConfirmChoice('cancel')"
            >
              Cancel
            </button>
            <button
              class="rounded px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              @click="handleConfirmChoice('discard')"
            >
              Discard
            </button>
            <button
              class="rounded bg-blue-500 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-600"
              @click="handleConfirmChoice('save')"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
