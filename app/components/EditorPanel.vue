<script setup lang="ts">
import type { Tab } from '~/composables/tabService/common/protocol'
import { useObservable } from '@vueuse/rxjs'

/**
 * 编辑器面板
 * 集成 Monaco Editor，Tab 状态由 TabService 管理
 */
const tabService = useTabService()

const tabs = useObservable<Tab[], Tab[]>(tabService.tabs$, { initialValue: [] as Tab[] })
const activeFilePath = useObservable<string | null, string | null>(tabService.activeTab$, { initialValue: null })

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

function handleTabClick(tab: Tab) {
  tabService.activateTab(tab.path)
}

function handleTabClose(tab: Tab) {
  tabService.closeTab(tab.path)
}

function handleToggleLock(tab: Tab) {
  if (tab.locked) {
    tabService.unlockTab(tab.path)
  }
  else {
    tabService.lockTab(tab.path)
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col bg-gray-900">
    <!-- 文件标签栏 -->
    <div class="h-10 flex shrink-0 items-center overflow-x-auto border-b border-gray-700 bg-gray-800">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        class="group relative h-full flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-gray-700 pl-4 pr-2 text-sm transition-colors"
        :class="[
          activeFilePath === tab.path
            ? 'bg-gray-900 text-gray-100'
            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200',
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

        <!-- 锁定/关闭按钮区域 -->
        <div class="flex shrink-0 items-center">
          <!-- 锁定时：显示锁图标，点击解锁 -->
          <button
            v-if="tab.locked"
            class="h-4 w-4 flex items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-600 hover:text-gray-300"
            title="Unlock tab"
            @click.stop="handleToggleLock(tab)"
          >
            <div class="i-carbon-locked text-[11px]" />
          </button>

          <!-- 未锁定时：hover 显示关闭按钮，点击图标可锁定 -->
          <template v-else>
            <!-- 关闭按钮（hover 时显示，平时透明占位） -->
            <button
              class="h-4 w-4 flex items-center justify-center rounded text-transparent transition-colors group-hover:text-gray-500 hover:!bg-gray-600 hover:!text-gray-300"
              title="Close tab"
              @click.stop="handleTabClose(tab)"
            >
              <div class="i-carbon-close text-[11px]" />
            </button>
          </template>
        </div>
      </div>

      <!-- 无 tab 时的占位 -->
      <div
        v-if="tabs?.length === 0"
        class="px-4 text-sm text-gray-600 italic"
      >
        No files
      </div>
    </div>

    <!-- Monaco Editor 容器 -->
    <div class="flex-1 overflow-hidden bg-gray-900">
      <div
        v-if="!activeFilePath"
        class="h-full w-full flex flex-col items-center justify-center gap-2 text-gray-600"
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
  </div>
</template>
