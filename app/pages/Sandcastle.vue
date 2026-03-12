<script setup lang="ts">
/**
 * Cesium Sandcastle 执行环境页面（iframe 模式）
 *
 * 通过 postMessage transport 接收来自 PreviewPanel 的 execute 消息，
 * 在沙箱化的 Cesium + Sandcastle 环境中执行代码并将结果回传给父窗口。
 *
 * 可复用的执行环境逻辑（Cesium 加载、Sandcastle API、代码执行）
 * 统一由 useCesiumSandbox 组合式函数提供。
 */

import { useEventListener } from '@vueuse/core'
import { useIframeTransport } from '~/composables/useTransport'

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
  script: [
    {
      type: 'importmap',
      innerHTML: JSON.stringify({
        imports: {
          Sandcastle: '/Sandcastle.js',
          cesium: '/cesium-shim.js',
        },
      }),
    },
  ],
})

// #region Transport & sandbox setup

const transport = useIframeTransport()

const { isLoadingOverlayVisible, executeOrQueue } = useCesiumSandbox({
  postToParent: msg => transport.value?.write(msg),
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
  const editorLine = event.lineno ?? undefined
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

    executeOrQueue(payload)
  }
})()

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
  transition:
    background 150ms ease-out,
    border-color 150ms ease-out;
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
