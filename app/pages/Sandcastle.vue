<script setup lang="ts">
/**
 * Cesium Sandcastle 执行环境页面
 * 提供沙箱化的 Cesium 代码执行环境，兼容 Cesium Sandcastle API
 */

import type { SandcastleShareData } from '~/composables/shareService/common/protocol'
import { useScriptTag } from '@vueuse/core'

// 禁用布局
definePageMeta({
  layout: false,
})

// ─── Cesium 加载状态 ────────────────────────────────────────────────────────

const isCesiumReady = ref(false)
const pendingExecutionData = ref<SandcastleShareData | null>(null)

// 使用 useScriptTag 动态加载 Cesium
const { load } = useScriptTag(
  'https://cdn.jsdelivr.net/npm/cesium@1.137.0/Build/Cesium/Cesium.js',
  () => {
    // Script tag loaded, start polling for Cesium availability
    pollForCesium()
  },
  {
    manual: true,
    async: true,
  },
)

/**
 * 轮询检查 Cesium 是否可用
 * 即使 script 标签加载完成，window.Cesium 可能仍未立即可用
 */
function pollForCesium() {
  if (typeof window.Cesium !== 'undefined') {
    isCesiumReady.value = true
    window.parent.postMessage({ type: 'ready' }, '*')

    // 执行队列中的代码
    if (pendingExecutionData.value) {
      executeCode(pendingExecutionData.value)
      pendingExecutionData.value = null
    }
  }
  else {
    setTimeout(pollForCesium, 100)
  }
}

// ─── Sandcastle API 状态 ────────────────────────────────────────────────────

const isLoadingOverlayVisible = ref(true)
const currentScriptElement = ref<HTMLScriptElement | null>(null)

interface SandcastleRegisteredFunction {
  func: Function
  lineNumber?: number
}

const sandcastleRegistered = ref<SandcastleRegisteredFunction[]>([])
let sandcastleDefaultAction: (() => void) | null = null

// ─── Sandcastle API 实现 ────────────────────────────────────────────────────

declare global {
  interface Window {
    Cesium: any
    Sandcastle: {
      bucket: string
      registered: SandcastleRegisteredFunction[]
      declare: (obj: Record<string, Function>) => void
      highlight: (obj: Record<string, Function>) => void
      finishedLoading: () => void
      addToolbarButton: (text: string, onclick: () => void, toolbarID?: string) => void
      addToggleButton: (text: string, checked: boolean, onchange: (checked: boolean) => void, toolbarID?: string) => void
      addToolbarMenu: (options: Array<{ text: string, onselect: () => void }>, toolbarID?: string) => void
      addDefaultToolbarButton: (text: string, onclick: () => void, toolbarID?: string) => void
      addDefaultToolbarMenu: (options: Array<{ text: string, onselect: () => void }>, toolbarID?: string) => void
      reset: () => void
    }
    startup?: (Cesium: any) => Promise<void>
    startupCalled?: boolean
  }
}

/**
 * 从调用栈中提取行号（用于 Sandcastle.declare）
 */
function extractLineNumber(): number | undefined {
  try {
    const stack = new Error().stack
    if (!stack)
      return undefined

    // 查找 "declare" 调用的上一行（用户代码行）
    const lines = stack.split('\n')
    // 跳过 Error、extractLineNumber、declare 本身
    const callerLine = lines[3]
    if (!callerLine)
      return undefined

    const match = callerLine.match(/:(\d+):/)
    return match?.[1] ? Number.parseInt(match[1], 10) : undefined
  }
  catch {
    return undefined
  }
}

// 在组件挂载后设置 Sandcastle API
onMounted(() => {
  window.Sandcastle = {
    bucket: 'sandcastle',
    registered: sandcastleRegistered.value,

    declare(obj: Record<string, Function>) {
      const lineNumber = extractLineNumber()
      for (const key in obj) {
        const func = obj[key]
        if (func) {
          sandcastleRegistered.value.push({
            func,
            lineNumber,
          })
        }
      }
    },

    highlight(obj: Record<string, Function>) {
      // 发送高亮消息到父窗口
      for (const key in obj) {
        const registered = sandcastleRegistered.value.find(r => r.func === obj[key])
        if (registered?.lineNumber) {
          window.parent.postMessage({
            type: 'highlight',
            lineNumber: registered.lineNumber,
          }, '*')
        }
      }
    },

    finishedLoading() {
      // 隐藏加载覆盖层（幂等操作）
      if (isLoadingOverlayVisible.value) {
        isLoadingOverlayVisible.value = false
        window.parent.postMessage({ type: 'finished' }, '*')
      }

      // 调用默认操作（如果设置了）
      if (sandcastleDefaultAction) {
        sandcastleDefaultAction()
        sandcastleDefaultAction = null
      }
    },

    addToolbarButton(text: string, onclick: () => void, toolbarID?: string) {
      const toolbar = toolbarID ? document.getElementById(toolbarID) : document.getElementById('toolbar')
      if (!toolbar)
        return

      const button = document.createElement('button')
      button.className = 'cesium-button'
      button.textContent = text
      button.onclick = onclick
      toolbar.appendChild(button)
    },

    addToggleButton(text: string, checked: boolean, onchange: (checked: boolean) => void, toolbarID?: string) {
      const toolbar = toolbarID ? document.getElementById(toolbarID) : document.getElementById('toolbar')
      if (!toolbar)
        return

      const label = document.createElement('label')
      label.className = 'cesium-button'

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = checked
      checkbox.onchange = () => {
        onchange(checkbox.checked)
      }

      label.appendChild(checkbox)
      label.appendChild(document.createTextNode(` ${text}`))
      toolbar.appendChild(label)
    },

    addToolbarMenu(options: Array<{ text: string, onselect: () => void }>, toolbarID?: string) {
      const toolbar = toolbarID ? document.getElementById(toolbarID) : document.getElementById('toolbar')
      if (!toolbar)
        return

      const select = document.createElement('select')
      select.className = 'cesium-button'

      options.forEach((option, index) => {
        const opt = document.createElement('option')
        opt.value = String(index)
        opt.textContent = option.text
        select.appendChild(opt)
      })

      select.onchange = () => {
        const index = Number.parseInt(select.value, 10)
        if (options[index])
          options[index].onselect()
      }

      toolbar.appendChild(select)
    },

    addDefaultToolbarButton(text: string, onclick: () => void, toolbarID?: string) {
      this.addToolbarButton(text, onclick, toolbarID)
      sandcastleDefaultAction = onclick
    },

    addDefaultToolbarMenu(options: Array<{ text: string, onselect: () => void }>, toolbarID?: string) {
      this.addToolbarMenu(options, toolbarID)
      // 设置第一个选项为默认操作
      if (options[0])
        sandcastleDefaultAction = options[0].onselect
    },

    reset() {
      // 清空工具栏
      const toolbar = document.getElementById('toolbar')
      if (toolbar)
        toolbar.innerHTML = ''

      // 显示加载覆盖层
      isLoadingOverlayVisible.value = true

      // 清空注册的函数
      sandcastleRegistered.value = []
      sandcastleDefaultAction = null
    },
  }
})

// ─── Console 劫持 ───────────────────────────────────────────────────────────

/**
 * 格式化控制台参数
 */
function formatArgs(args: IArguments | any[]): string {
  return Array.prototype.slice
    .call(args)
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

// 在组件挂载后劫持控制台
onMounted(() => {
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn

  console.log = function (...args: any[]) {
    originalLog.apply(console, args)
    window.parent.postMessage({
      type: 'log',
      level: 'log',
      message: formatArgs(args),
    }, '*')
  }

  console.error = function (...args: any[]) {
    originalError.apply(console, args)
    window.parent.postMessage({
      type: 'log',
      level: 'error',
      message: formatArgs(args),
    }, '*')
  }

  console.warn = function (...args: any[]) {
    originalWarn.apply(console, args)
    window.parent.postMessage({
      type: 'log',
      level: 'warn',
      message: formatArgs(args),
    }, '*')
  }
})

// ─── 全局错误处理 ───────────────────────────────────────────────────────────

/**
 * 将脚本行号转换为编辑器行号
 * 模板包装器占用 3 行，因此用户代码从第 4 行开始
 */
function scriptLineToEditorLine(scriptLine: number): number {
  return scriptLine - 3
}

onMounted(() => {
  window.onerror = (errorMsg, url, lineNumber, columnNumber, error) => {
    // 调整行号（减去模板包装器的 3 行）
    const editorLine = lineNumber ? scriptLineToEditorLine(lineNumber) : undefined

    window.parent.postMessage({
      type: 'error',
      message: String(errorMsg),
      lineNumber: editorLine,
      stack: error?.stack,
    }, '*')

    return false
  }

  window.onunhandledrejection = (event) => {
    window.parent.postMessage({
      type: 'error',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
    }, '*')
  }
})

// ─── 代码执行 ───────────────────────────────────────────────────────────────

/**
 * 将用户代码包装在 Sandcastle 模板中
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

/**
 * 执行用户代码
 */
function executeCode(data: SandcastleShareData) {
  try {
    // 重置 Sandcastle 状态
    window.Sandcastle.reset()

    // 移除之前的 script 元素
    if (currentScriptElement.value) {
      currentScriptElement.value.parentNode?.removeChild(currentScriptElement.value)
      currentScriptElement.value = null
    }

    // 通知父窗口即将重新加载
    window.parent.postMessage({ type: 'reload' }, '*')

    // 包装用户代码
    const wrapped = wrapCodeInTemplate(data.code)

    // 注入新的 script 元素
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.textContent = wrapped
    document.body.appendChild(script)
    currentScriptElement.value = script
  }
  catch (err) {
    console.error(`Failed to execute code: ${err}`)
  }
}

// ─── 消息监听 ───────────────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'execute') {
      const data = event.data.payload as SandcastleShareData
      if (!data?.code)
        return

      if (isCesiumReady.value) {
        executeCode(data)
      }
      else {
        // Cesium 尚未加载，将代码加入队列
        pendingExecutionData.value = data
      }
    }
  })

  // 发送 ready 消息（即使 Cesium 未加载完成，也先发送以便父窗口可以缓冲消息）
  window.parent.postMessage({ type: 'ready' }, '*')

  // 开始加载 Cesium
  load(true)
})
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
