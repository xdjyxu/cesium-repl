<script setup lang="ts">
/**
 * 预览面板
 * 显示编译后的代码运行结果
 */
defineProps<{
  /**
   * JavaScript 代码
   */
  code?: string | null
  /**
   * HTML 代码
   */
  html?: string | null
}>()

const isConsoleOpen = ref(false)
const consoleHeight = ref(200)

function toggleConsole() {
  isConsoleOpen.value = !isConsoleOpen.value
}
</script>

<template>
  <div class="h-full w-full flex flex-col bg-gray-900">
    <!-- 预览内容 -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- 预览区域 -->
      <div class="flex-1 overflow-auto bg-white">
        <div v-if="!code && !html" class="h-full w-full flex items-center justify-center text-gray-400">
          Preview area - Cesium viewer will be rendered here
        </div>
        <div v-else class="h-full p-4">
          <div v-if="html" class="mb-4">
            <h3 class="mb-2 text-sm text-gray-700 font-semibold">
              HTML:
            </h3>
            <pre class="overflow-auto rounded bg-gray-100 p-3 text-xs"><code>{{ html }}</code></pre>
          </div>
          <div v-if="code">
            <h3 class="mb-2 text-sm text-gray-700 font-semibold">
              Compiled JavaScript:
            </h3>
            <pre class="overflow-auto rounded bg-gray-100 p-3 text-xs"><code>{{ code }}</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Console 面板 -->
    <div
      class="border-t border-gray-700 bg-gray-900 transition-all"
      :style="{ height: isConsoleOpen ? `${consoleHeight}px` : '32px' }"
    >
      <!-- Console 标题栏 -->
      <div
        class="h-8 flex cursor-pointer items-center justify-between bg-gray-800 px-4"
        @click="toggleConsole"
      >
        <div class="flex items-center gap-2">
          <div
            class="i-carbon-chevron-right text-sm text-gray-400 transition-transform"
            :class="[
              { 'rotate-90': isConsoleOpen },
            ]"
          />
          <span class="text-sm text-gray-200">Console</span>
        </div>
        <button
          v-if="isConsoleOpen"
          class="h-7 w-7 flex items-center justify-center rounded bg-transparent text-red-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
          title="Clear console"
          @click.stop
        >
          <div class="i-carbon-trash-can text-base" />
        </button>
      </div>

      <!-- Console 内容 -->
      <div v-if="isConsoleOpen" class="h-[calc(100%-32px)] overflow-y-auto p-2 text-xs font-mono">
        <div class="text-gray-400">
          Console output will appear here...
        </div>
      </div>
    </div>
  </div>
</template>
