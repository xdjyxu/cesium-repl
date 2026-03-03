<script setup lang="ts">
import type { Theme } from '~/composables/profileService/common/protocol'
import { useObservable } from '@vueuse/rxjs'

/**
 * VSCode 风格的侧边栏
 * 提供 Gallery 和 Editor 视图切换
 */
export type SidebarView = 'gallery' | 'files' | 'editor'

interface Props {
  activeView?: SidebarView
}

const props = withDefaults(defineProps<Props>(), {
  activeView: 'editor',
})

const emit = defineEmits<{
  'update:activeView': [view: SidebarView]
}>()

const views = [
  { id: 'gallery' as const, icon: 'i-carbon-grid', label: 'Gallery' },
  { id: 'editor' as const, icon: 'i-carbon-code', label: 'Editor' },
  { id: 'files' as const, icon: 'i-carbon-folder', label: 'Explorer' },
]

const isSettingsOpen = ref(false)
const profileService = useProfileService()
const profile = useObservable(profileService.profile$)
const currentTheme = computed(() => profile.value?.theme ?? 'auto')

function selectView(view: SidebarView) {
  emit('update:activeView', view)
}

function toggleSettings() {
  isSettingsOpen.value = !isSettingsOpen.value
}

function handleThemeChange(event: Event) {
  const theme = (event.target as HTMLSelectElement).value as Theme
  profileService.setTheme(theme)
}
</script>

<template>
  <div class="h-full w-12 flex flex-col items-center bg-gray-100 py-2 dark:bg-gray-800">
    <!-- 顶部视图切换按钮 -->
    <div class="flex flex-col items-center gap-2">
      <button
        v-for="view in views"
        :key="view.id"
        class="h-12 w-12 flex items-center justify-center rounded transition-colors"
        :class="[
          activeView === view.id
            ? 'bg-gray-200 text-blue-500 dark:bg-gray-700 dark:text-blue-400'
            : 'bg-transparent text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300',
        ]"
        :title="view.label"
        @click="selectView(view.id)"
      >
        <div class="text-xl" :class="[view.icon]" />
      </button>
    </div>

    <!-- 底部设置按钮 -->
    <div class="mt-auto">
      <button
        class="h-12 w-12 flex items-center justify-center rounded bg-transparent text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        title="Settings"
        @click="toggleSettings"
      >
        <div class="i-carbon-settings text-xl" />
      </button>
    </div>

    <!-- 设置弹窗 -->
    <Teleport to="body">
      <div
        v-if="isSettingsOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click="isSettingsOpen = false"
      >
        <div
          class="max-w-md w-full rounded-lg bg-gray-100 p-6 shadow-xl dark:bg-gray-800"
          @click.stop
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg text-gray-800 font-semibold dark:text-gray-200">
              Settings
            </h2>
            <button
              class="h-8 w-8 flex items-center justify-center rounded bg-transparent text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              @click="isSettingsOpen = false"
            >
              <div class="i-carbon-close text-xl" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm text-gray-700 dark:text-gray-300">Theme</label>
              <select
                :value="currentTheme"
                class="w-full border border-gray-300 rounded bg-gray-200 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                @change="handleThemeChange"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
