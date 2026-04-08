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
  'newSandcastle': []
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
const tokenInput = ref(profile.value?.cesiumAccessToken ?? '')
const isTokenVisible = ref(false)
const autoCompile = computed(() => profile.value?.autoCompile ?? true)

watch(
  () => profile.value?.cesiumAccessToken,
  (val) => { tokenInput.value = val ?? '' },
)

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

function handleTokenBlur() {
  const trimmed = tokenInput.value.trim()
  profileService.setAccessToken(trimmed || undefined)
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

    <!-- New Sandcastle 操作按钮（位于 Explorer 后） -->
    <div class="mt-2">
      <button
        class="h-12 w-12 flex items-center justify-center rounded bg-transparent text-gray-400 transition-colors hover:bg-gray-200 dark:text-gray-500 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        title="New Sandcastle"
        @click="emit('newSandcastle')"
      >
        <div class="i-carbon-add-large text-xl" />
      </button>
    </div>

    <!-- 底部设置按钮 -->
    <div class="mt-auto">
      <button
        class="h-12 w-12 flex items-center justify-center rounded bg-transparent text-gray-400 transition-colors hover:bg-gray-200 dark:text-gray-500 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
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
              class="h-8 w-8 flex items-center justify-center rounded bg-transparent text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200"
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
                class="w-full border border-gray-300 rounded bg-gray-200 px-3 py-2 text-sm text-gray-800 outline-none transition-colors dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200"
                @change="handleThemeChange"
              >
                <option value="dark">
                  Dark
                </option>
                <option value="light">
                  Light
                </option>
                <option value="auto">
                  Auto
                </option>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-sm text-gray-700 dark:text-gray-300">Cesium Ion Access Token</label>
              <div class="relative">
                <input
                  v-model="tokenInput"
                  :type="isTokenVisible ? 'text' : 'password'"
                  placeholder="Leave empty to use the default token"
                  class="w-full border border-gray-300 rounded bg-gray-200 py-2 pl-3 pr-9 text-sm text-gray-800 outline-none transition-colors dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500"
                  @blur="handleTokenBlur"
                  @keydown.enter="handleTokenBlur"
                >
                <button
                  type="button"
                  class="absolute right-2 top-1/2 text-gray-400 transition-colors -translate-y-1/2 hover:text-gray-700 dark:hover:text-gray-200"
                  :title="isTokenVisible ? 'Hide token' : 'Show token'"
                  @click="isTokenVisible = !isTokenVisible"
                >
                  <div :class="isTokenVisible ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-base" />
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm text-gray-700 dark:text-gray-300">Auto Compile</label>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  保存文件后自动编译并更新沙箱
                </p>
              </div>
              <button
                type="button"
                class="relative h-5 w-9 inline-flex shrink-0 cursor-pointer border-2 border-transparent rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
                :class="autoCompile ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'"
                :title="autoCompile ? 'Disable auto compile' : 'Enable auto compile'"
                @click="profileService.setAutoCompile(!autoCompile)"
              >
                <span
                  class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="autoCompile ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
