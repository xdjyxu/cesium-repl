<script setup lang="ts">
import type { SidebarView } from '~/components/Sidebar.vue'
import { useArtifactService } from '~/composables/artifactService/common/useArtifactService'
import { useShareService } from '~/composables/shareService/common/useShareService'

const activeView = ref<SidebarView>('editor')

// 加载示例（依赖 fileService，必须在 provide 的子组件中调用）
const { state } = useExampleLoader()

// 集成自动编译功能
useAutoCompile(toRef(() => state.loading))

const artifactService = useArtifactService()
const shareService = useShareService()

function openStandalone() {
  const artifact = artifactService.getArtifact()
  if (!artifact)
    return
  const compressed = shareService.compress(artifact)
  window.open(`/standalone#c=${compressed}`, '_blank')
}

function handleSelectFile(_path: string) {
  activeView.value = 'editor'
}
</script>

<template>
  <div class="h-screen w-screen flex overflow-hidden bg-gray-900">
    <!-- 左侧区域和右侧预览区域 -->
    <SplitPane direction="horizontal" :initial-ratio="0.4" :min-size="300">
      <template #first>
        <!-- 左侧区域（侧边栏 + 主内容区） -->
        <div class="h-full w-full flex flex-col overflow-hidden">
          <!-- Header（只覆盖左侧） -->
          <div class="h-10 flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-800 px-4">
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
                @click="openStandalone"
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
              <FileTreePanel
                v-else-if="activeView === 'files'"
                @select-file="handleSelectFile"
              />
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
