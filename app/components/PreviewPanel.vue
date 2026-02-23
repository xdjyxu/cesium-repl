<script setup lang="ts">
/**
 * 预览面板
 * 显示编译后的代码运行结果
 * 使用 iframe 沙箱执行代码并捕获控制台输出
 */

import type { SandcastleShareData } from '~/composables/shareService/common/protocol'
import { useObservable } from '@vueuse/rxjs'
import { useArtifactService } from '~/composables/artifactService/common/useArtifactService'
import { useParentTransport } from '~/composables/useTransport'

const artifactService = useArtifactService()
const artifact = useObservable(artifactService.artifact$)

const isConsoleOpen = ref(false)
const consoleHeight = ref(200)
const iframeRef = ref<HTMLIFrameElement>()
const iframeReady = ref(false)
const transport = useParentTransport(iframeRef)

/**
 * 控制台日志条目
 */
interface ConsoleEntry {
  id: number
  level: 'log' | 'error' | 'warn'
  message: string
  timestamp: Date
  lineNumber?: number
}

const consoleEntries = ref<ConsoleEntry[]>([])
let entryIdCounter = 0

function addConsoleEntry(level: 'log' | 'error' | 'warn', message: string, lineNumber?: number) {
  consoleEntries.value.push({
    id: entryIdCounter++,
    level,
    message,
    timestamp: new Date(),
    lineNumber,
  })

  if (level === 'error' && !isConsoleOpen.value)
    isConsoleOpen.value = true
}

function clearConsole() {
  consoleEntries.value = []
}

function toggleConsole() {
  isConsoleOpen.value = !isConsoleOpen.value
}

/**
 * 发送代码到 iframe 执行
 */
function sendCodeToIframe() {
  if (!iframeReady.value)
    return

  clearConsole()

  const payload: SandcastleShareData = {
    code: artifact.value?.code || '',
    html: artifact.value?.html || '',
  }

  transport.value?.write({ type: 'execute', payload })
}

/**
 * 格式化时间戳
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

/**
 * 获取控制台条目的样式类
 */
function getEntryClass(level: string): string {
  switch (level) {
    case 'error': return 'text-red-400'
    case 'warn': return 'text-yellow-400'
    default: return 'text-gray-300'
  }
}

// 监听来自 iframe 的消息（仅处理来自沙箱 iframe 的消息）
watch(transport, (t, _old, onCleanup) => {
  if (!t)
    return
  const controller = new AbortController()
  ;(async () => {
    for await (const data of t.read({ signal: controller.signal })) {
      switch (data.type) {
        case 'ready':
          iframeReady.value = true
          sendCodeToIframe()
          break
        case 'log':
          addConsoleEntry(data.level, data.message)
          break
        case 'error':
          addConsoleEntry('error', data.message, data.lineNumber)
          break
        case 'reload':
        case 'highlight':
          // 暂不处理
          break
      }
    }
  })()
  onCleanup(() => controller.abort())
}, { immediate: true })

// 当代码更新时，发送到 iframe
watch(artifact, () => {
  if (iframeReady.value)
    sendCodeToIframe()
}, { deep: true })
</script>

<template>
  <div class="h-full w-full flex flex-col bg-gray-900">
    <!-- 预览内容 -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- iframe 沙箱 -->
      <div class="relative flex-1 overflow-hidden bg-white">
        <ClientOnly>
          <iframe
            ref="iframeRef"
            src="/Sandcastle"
            class="h-full w-full border-none"
            title="Cesium Sandbox"
          />
        </ClientOnly>
        <div
          v-if="!artifact"
          class="pointer-events-none absolute inset-0 flex items-center justify-center bg-white text-gray-400"
        >
          Preview area - Cesium viewer will be rendered here
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
          <span
            v-if="consoleEntries.length > 0"
            class="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300"
          >
            {{ consoleEntries.length }}
          </span>
        </div>
        <button
          v-if="isConsoleOpen"
          class="h-7 w-7 flex items-center justify-center rounded bg-transparent text-red-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
          title="Clear console"
          @click.stop="clearConsole"
        >
          <div class="i-carbon-trash-can text-base" />
        </button>
      </div>

      <!-- Console 内容 -->
      <div
        v-if="isConsoleOpen"
        class="h-[calc(100%-32px)] overflow-y-auto p-2 text-xs font-mono"
      >
        <div v-if="consoleEntries.length === 0" class="text-gray-500">
          Console output will appear here...
        </div>
        <div
          v-for="entry in consoleEntries"
          :key="entry.id"
          class="mb-1 flex items-start gap-2 border-b border-gray-800 pb-1"
        >
          <!-- 时间戳 -->
          <span class="shrink-0 text-gray-600">
            {{ formatTime(entry.timestamp) }}
          </span>

          <!-- 级别图标 -->
          <span class="shrink-0">
            <span v-if="entry.level === 'error'" class="text-red-500">✖</span>
            <span v-else-if="entry.level === 'warn'" class="text-yellow-500">⚠</span>
            <span v-else class="text-blue-500">ℹ</span>
          </span>

          <!-- 消息内容 -->
          <pre
            class="flex-1 whitespace-pre-wrap break-all"
            :class="getEntryClass(entry.level)"
          >{{ entry.message }}</pre>

          <!-- 行号（如果有） -->
          <span v-if="entry.lineNumber" class="shrink-0 text-xs text-gray-600">
            :{{ entry.lineNumber }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
