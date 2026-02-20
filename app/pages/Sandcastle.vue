<script setup lang="ts">
/**
 * Cesium Sandcastle 执行环境页面
 * 提供沙箱化的 Cesium 代码执行环境，兼容 Cesium Sandcastle API
 */

import type { SandcastleShareData } from '~/composables/shareService/common/protocol'
import type { SandcastleAPI } from '~/utils/sandcastle'
import { useEventListener, useScriptTag } from '@vueuse/core'
import { useIframeTransport } from '~/composables/useTransport'
import { createSandcastleAPI, TEMPLATE_HEADER_LINES } from '~/utils/sandcastle'

// 禁用布局
definePageMeta({
  layout: false,
})

useHead({
  title: 'Cesium Sandbox',
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
  link: [
    {
      rel: 'stylesheet',
      href: 'https://cdn.jsdelivr.net/npm/cesium@1.137.0/Build/Cesium/Widgets/widgets.css',
    },
  ],
})

// #region Global type augmentation

declare global {
  interface Window {
    Cesium: any
    Sandcastle: SandcastleAPI
    startup?: (Cesium: any) => Promise<void>
    startupCalled?: boolean
  }
}

// #endregion

// #region Cesium 加载状态

const isCesiumReady = ref(false)
const pendingExecutionData = ref<SandcastleShareData | null>(null)
const transport = useIframeTransport()

const { load } = useScriptTag(
  'https://cdn.jsdelivr.net/npm/cesium@1.137.0/Build/Cesium/Cesium.js',
  () => pollForCesium(),
  { manual: true, async: true },
)

/**
 * 轮询检查 Cesium 是否可用
 * 即使 script 标签加载完成，window.Cesium 可能仍未立即可用
 */
function pollForCesium() {
  if (typeof window.Cesium !== 'undefined') {
    isCesiumReady.value = true
    transport.value?.write({ type: 'ready' })

    if (pendingExecutionData.value) {
      executeCode(pendingExecutionData.value)
      pendingExecutionData.value = null
    }
  }
  else {
    setTimeout(pollForCesium, 100)
  }
}

// #endregion

// #region Sandcastle API

const isLoadingOverlayVisible = ref(true)
let currentScriptElement: HTMLScriptElement | null = null
let clearUI: (() => void) | undefined

onMounted(() => {
  const runtime = createSandcastleAPI({
    onLoadingChange: (visible) => {
      isLoadingOverlayVisible.value = visible
    },
    postToParent: msg => transport.value?.write(msg),
  })
  window.Sandcastle = runtime.api
  clearUI = runtime.clearUI
})

// #endregion

// #region Console 劫持

// Capture originals at setup time, before any override, to prevent stacking on re-mount
// eslint-disable-next-line no-console
const _originalLog = console.log
const _originalError = console.error
const _originalWarn = console.warn

function formatArgs(args: any[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2)
        }
        catch {
          return String(arg)
        }
      }
      return String(arg)
    })
    .join(' ')
}

onMounted(() => {
  // eslint-disable-next-line no-console
  console.log = (...args: any[]) => {
    _originalLog.apply(console, args)
    transport.value?.write({ type: 'log', level: 'log', message: formatArgs(args) })
  }
  console.error = (...args: any[]) => {
    _originalError.apply(console, args)
    transport.value?.write({ type: 'log', level: 'error', message: formatArgs(args) })
  }
  console.warn = (...args: any[]) => {
    _originalWarn.apply(console, args)
    transport.value?.write({ type: 'log', level: 'warn', message: formatArgs(args) })
  }
})

onUnmounted(() => {
  // eslint-disable-next-line no-console
  console.log = _originalLog
  console.error = _originalError
  console.warn = _originalWarn
})

// #endregion

// #region 全局错误处理

useEventListener(window, 'error', (event: ErrorEvent) => {
  const editorLine = event.lineno ? event.lineno - TEMPLATE_HEADER_LINES : undefined
  transport.value?.write({
    type: 'error',
    message: String(event.message),
    lineNumber: editorLine,
    stack: event.error?.stack,
  })
})

useEventListener(window, 'unhandledrejection', (event: PromiseRejectionEvent) => {
  transport.value?.write({
    type: 'error',
    message: `Unhandled Promise Rejection: ${event.reason}`,
    stack: event.reason?.stack,
  })
})

// #endregion

// #region 代码执行

/**
 * 将用户代码包装在 Sandcastle 启动模板中
 * 模板头占 TEMPLATE_HEADER_LINES 行，用户代码从第 TEMPLATE_HEADER_LINES+1 行开始
 */
function wrapCodeInTemplate(code: string): string {
  return [
    'window.startup = async function (Cesium) {',
    '  \'use strict\';',
    '  //Sandcastle_Begin',
    code,
    '  //Sandcastle_End',
    '  Sandcastle.finishedLoading();',
    '};',
    'if (typeof Cesium !== \'undefined\') {',
    '  window.startupCalled = true;',
    '  window.startup(Cesium).catch(function(error) {',
    '    console.error(error);',
    '  });',
    '}',
  ].join('\n')
}

function executeCode(data: SandcastleShareData) {
  try {
    clearUI?.()

    if (currentScriptElement) {
      currentScriptElement.parentNode?.removeChild(currentScriptElement)
      currentScriptElement = null
    }

    transport.value?.write({ type: 'reload' })

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.textContent = wrapCodeInTemplate(data.code)
    document.body.appendChild(script)
    currentScriptElement = script
  }
  catch (err) {
    console.error(`Failed to execute code: ${err}`)
  }
}

// #endregion

// #region 消息监听

;(async () => {
  if (!transport.value)
    return
  for await (const data of transport.value.read()) {
    if (data?.type !== 'execute')
      continue

    const { payload } = data
    if (!payload?.code)
      continue

    if (isCesiumReady.value) {
      executeCode(payload)
    }
    else {
      pendingExecutionData.value = payload
    }
  }
})()

onMounted(() => {
  load(true)
})

// #endregion
</script>

<template>
  <div id="cesiumContainer" />

  <div
    v-show="isLoadingOverlayVisible"
    id="loadingOverlay"
  >
    <h1>Loading...</h1>
  </div>

  <div id="toolbar" />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
  position: relative;
}

#loadingOverlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

#loadingOverlay h1 {
  color: white;
  font-size: 1.5rem;
  font-family: sans-serif;
}

/* Toolbar */
#toolbar {
  position: absolute;
  top: 0;
  left: 0;
  margin: 5px;
  padding: 8px;
  background: #2a2d35;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: calc(100% - 130px);
  overflow-y: auto;
  z-index: 40;
}

#toolbar:empty {
  display: none;
}

/* Button */
.stratakit-mimic-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  min-height: 1.5rem;
  background: #3d4049;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  font-weight: 500;
  font-family: sans-serif;
  cursor: pointer;
  user-select: none;
  transition: background 150ms ease-out;
}

.stratakit-mimic-button:hover {
  background: #4a4e5a;
}

.stratakit-mimic-button:active {
  background: #555a68;
}

/* Toggle field */
.stratakit-mimic-field {
  display: inline-grid;
  grid-template-columns: auto auto;
  gap: 6px;
  align-items: center;
  cursor: pointer;
}

/* Switch (pill toggle) */
.stratakit-mimic-switch {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  display: inline-block;
  width: 2rem;
  height: 1.125rem;
  background: #555a68;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 150ms ease-out, border-color 150ms ease-out;
}

.stratakit-mimic-switch::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 2px;
  transform: translateY(-50%);
  width: 0.75rem;
  height: 0.75rem;
  background: white;
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: transform 150ms ease-out;
}

.stratakit-mimic-switch:checked {
  background: #4a90d9;
  border-color: #4a90d9;
}

.stratakit-mimic-switch:checked::after {
  transform: translateY(-50%) translateX(0.875rem);
}

/* Label */
.stratakit-mimic-label {
  color: #c0c4cc;
  font-size: 12px;
  font-family: sans-serif;
  cursor: pointer;
  user-select: none;
}

/* Select wrapper */
.stratakit-mimic-select-root {
  display: inline-grid;
  align-items: center;
}

select.stratakit-mimic-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 1.5rem;
  cursor: pointer;
}
</style>
