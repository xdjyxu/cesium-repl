<script setup lang="ts">
import type { SidebarView } from '~/components/Sidebar.vue'

defineProps<{
  /**
   * 文件系统加载状态
   */
  fsLoading?: boolean
}>()

const activeView = ref<SidebarView>('editor')
</script>

<template>
  <div class="h-screen w-screen flex overflow-hidden bg-gray-900">
    <!-- 左侧区域和右侧预览区域 -->
    <SplitPane direction="horizontal" :initial-ratio="0.4" :min-size="300">
      <template #first>
        <!-- 左侧区域（侧边栏 + 主内容区） -->
        <div class="h-full w-full flex flex-col overflow-hidden">
          <!-- Header（只覆盖左侧） -->
          <div class="h-10 flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4">
            <span class="text-sm text-gray-200 font-semibold">Cesium REPL</span>
            <div class="flex items-center gap-2">
              <button
                class="h-7 rounded bg-gray-800 px-3 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
                title="Share"
              >
                Share
              </button>
              <button
                class="h-7 rounded bg-gray-800 px-3 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
                title="Open in standalone window"
              >
                Standalone
              </button>
            </div>
          </div>

          <!-- 侧边栏 + 主内容区 -->
          <div class="flex flex-1 overflow-hidden">
            <Sidebar v-model:active-view="activeView" />

            <div class="flex-1 overflow-hidden">
              <GalleryPanel v-if="activeView === 'gallery'" />
              <EditorPanel v-else />
            </div>
          </div>
        </div>
      </template>

      <template #second>
        <!-- 右侧预览区域（独立，不受 header 影响） -->
        <PreviewPanel />
      </template>
    </SplitPane>
  </div>
</template>
