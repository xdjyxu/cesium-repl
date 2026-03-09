<script setup lang="ts">
import type { SidebarView } from '~/components/Sidebar.vue'

const activeView = ref<SidebarView>('editor')

// 加载示例（依赖 fileService，必须在 provide 的子组件中调用）
const { state, loadIndex } = useExampleLoader()

// 集成自动编译功能
useAutoCompile(toRef(() => state.loading))

// 主题系统：监听 resolvedTheme$ 并同步到 <html> 类名和 Monaco 主题
const profileService = useProfileService()
const monacoLoaderService = useMonacoLoaderService()

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
  monacoLoaderService.getMonaco().then(monaco =>
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs'),
  )
}

onMounted(() => {
  const sub = profileService.resolvedTheme$.subscribe(applyTheme)
  onUnmounted(() => sub.unsubscribe())
})

const { getCompressed } = useShareData()

function openStandalone() {
  const compressed = getCompressed()
  if (!compressed)
    return
  window.open(`/standalone#c=${compressed}`, '_blank')
}

function handleSelectFile(_path: string) {
  activeView.value = 'editor'
}

const router = useRouter()

async function handleNewSandcastle() {
  // 清除 URL 参数（如 ?id=xxx 或 #c=xxx），让 useExampleLoader 的 watcher 归位到 index
  const route = router.currentRoute.value
  const isAtRoot = !route.query.id && !route.hash
  if (!isAtRoot) {
    await router.push('/')
    // watcher 会自动加载 index 示例，无需再手动调用
  }
  else {
    // 已在根路由，直接重置
    await loadIndex()
  }
  activeView.value = 'editor'
}
</script>

<template>
  <div class="h-screen w-screen flex overflow-hidden bg-white dark:bg-gray-900">
    <!-- 左侧区域和右侧预览区域 -->
    <SplitPane direction="horizontal" :initial-ratio="0.4" :min-size="300">
      <template #first>
        <!-- 左侧区域（侧边栏 + 主内容区） -->
        <div class="h-full w-full flex flex-col overflow-hidden">
          <!-- Header（只覆盖左侧） -->
          <div class="h-10 flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-100 px-4 dark:border-gray-700 dark:bg-gray-800">
            <span class="text-sm text-gray-800 font-semibold dark:text-gray-200">Cesium REPL</span>
            <div class="flex items-center gap-2">
              <SharePopover />
              <button
                class="h-7 rounded bg-gray-100 px-3 text-sm text-gray-500 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:text-gray-400 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                title="Open in standalone window"
                @click="openStandalone"
              >
                Standalone
              </button>
            </div>
          </div>

          <!-- 侧边栏 + 主内容区 -->
          <div class="flex flex-1 overflow-hidden">
            <Sidebar v-model:active-view="activeView" @new-sandcastle="handleNewSandcastle" />

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
