<script setup lang="ts">
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

function selectView(view: SidebarView) {
  emit('update:activeView', view)
}

function toggleSettings() {
  isSettingsOpen.value = !isSettingsOpen.value
}
</script>

<template>
  <div class="h-full w-12 flex flex-col items-center bg-gray-800 py-2">
    <!-- 顶部视图切换按钮 -->
    <div class="flex flex-col items-center gap-2">
      <button
        v-for="view in views"
        :key="view.id"
        class="h-12 w-12 flex items-center justify-center rounded transition-colors" :class="[
          activeView === view.id
            ? 'bg-gray-700 text-blue-400'
            : 'bg-transparent text-gray-500 hover:bg-gray-700 hover:text-gray-300',
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
        class="h-12 w-12 flex items-center justify-center rounded bg-transparent text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
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
          class="max-w-md w-full rounded-lg bg-gray-800 p-6 shadow-xl"
          @click.stop
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg text-gray-200 font-semibold">
              Settings
            </h2>
            <button
              class="h-8 w-8 flex items-center justify-center rounded bg-transparent text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
              @click="isSettingsOpen = false"
            >
              <div class="i-carbon-close text-xl" />
            </button>
          </div>

          <form class="space-y-4" @submit.prevent>
            <div>
              <label class="mb-1 block text-sm text-gray-300">Profile Name</label>
              <input
                type="text"
                placeholder="Enter profile name"
                class="w-full border border-gray-600 rounded bg-gray-700 px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-1 block text-sm text-gray-300">Description</label>
              <textarea
                placeholder="Enter description"
                rows="3"
                class="w-full border border-gray-600 rounded bg-gray-700 px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-blue-500"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm text-gray-300">Theme</label>
              <select
                class="w-full border border-gray-600 rounded bg-gray-700 px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-blue-500"
              >
                <option>Dark</option>
                <option>Light</option>
                <option>Auto</option>
              </select>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                class="rounded bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600"
                @click="isSettingsOpen = false"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
