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

onMounted(() => {
  window.Sandcastle = createSandcastleAPI({
    onLoadingChange: (visible) => {
      isLoadingOverlayVisible.value = visible
    },
    postToParent: msg => transport.value?.write(msg),
  })
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
    window.Sandcastle.reset()

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
  <Html>
    <Head>
      <Title>Cesium Sandbox</Title>
      <Meta charset="utf-8" />
      <Meta name="viewport" content="width=device-width, initial-scale=1" />
      <Link
        href="https://cdn.jsdelivr.net/npm/cesium@1.137.0/Build/Cesium/Widgets/widgets.css"
        rel="stylesheet"
      />
      <Style>
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

        #toolbar {
        position: fixed;
        top: 8px;
        left: 8px;
        z-index: 40;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        }

        .cesium-button {
        display: inline-block;
        padding: 4px 12px;
        background: white;
        border: 1px solid #444;
        border-radius: 4px;
        color: #333;
        font-size: 14px;
        font-family: sans-serif;
        cursor: pointer;
        transition: background 0.2s;
        }

        .cesium-button:hover {
        background: #f0f0f0;
        }

        .cesium-button:active {
        background: #e0e0e0;
        }
      </Style>
    </Head>
    <Body>
      <div id="cesiumContainer" />

      <div
        v-show="isLoadingOverlayVisible"
        id="loadingOverlay"
      >
        <h1>Loading...</h1>
      </div>

      <div id="toolbar" />
    </Body>
  </Html>
</template>
