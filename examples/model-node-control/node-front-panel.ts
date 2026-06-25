/**
 * node-front-panel — 飞机前方偏移设置面板
 *
 * 在 Cesium 容器底部创建浮动卡片，提供：
 *   - 数值输入（前方距离 / 横向偏移 / 垂直偏移）
 *   - 移动执行按钮（左桨 / 右桨 / 双桨）
 *   - 快速预设按钮组
 *
 * 面板纯 DOM 构建，不依赖 Cesium API。
 */

import type { FrontSettings, FrontPanelAPI, ApplyCallback } from './types.ts'

// #region 默认值

export function createDefaultFrontSettings(): FrontSettings {
  return { distance: 15, lateral: 0, vertical: 0 }
}

// #endregion

// #region 面板构建

/**
 * 在指定容器内创建浮动设置面板。
 *
 * @param container  DOM 容器（通常为 cesiumContainer）
 * @param settings   初始设置值（会被面板内部引用并直接修改）
 * @param onApply    点击移动按钮时的回调
 * @returns 面板控制 API
 */
export function createFrontSettingsPanel(
  container: HTMLElement,
  settings: FrontSettings,
  onApply: ApplyCallback,
): FrontPanelAPI {
  // ── 引用（闭包捕获） ──
  let distInput: HTMLInputElement
  let latInput: HTMLInputElement
  let vertInput: HTMLInputElement

  // ════════════════════════════════════════════════════════
  // 面板根节点
  // ════════════════════════════════════════════════════════
  const panel = document.createElement('div')
  panel.id = 'front-settings-panel'
  panel.style.cssText = [
    'position: absolute',
    'bottom: 12px',
    'left: 50%',
    'transform: translateX(-50%)',
    'z-index: 10',
    // 外观
    'background: oklch(24.37% 0.006 268.32 / 0.92)',
    'backdrop-filter: blur(6px)',
    'border: 1px solid oklch(32.63% 0.014 268.32)',
    'border-radius: 8px',
    'padding: 10px 14px',
    // 布局
    'display: flex',
    'flex-direction: column',
    'gap: 8px',
    // 字体
    'font-family: sans-serif',
    'font-size: 12px',
    'color: #ccc',
    // 阴影
    'box-shadow: 0 4px 16px rgba(0,0,0,0.4)',
    // 过渡
    'transition: opacity 0.2s ease',
  ].join(';')

  // ════════════════════════════════════════════════════════
  // 标题栏
  // ════════════════════════════════════════════════════════
  const titleBar = document.createElement('div')
  titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;'

  const title = document.createElement('span')
  title.textContent = '✈ 飞机前方设置'
  title.style.cssText = 'font-weight:600;font-size:13px;color:#eee;white-space:nowrap;'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '✕'
  closeBtn.title = '关闭面板'
  closeBtn.style.cssText = [
    'background:none',
    'border:none',
    'color:#888',
    'cursor:pointer',
    'font-size:13px',
    'padding:0 2px',
    'line-height:1',
  ].join(';')
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#eee' })
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#888' })
  closeBtn.addEventListener('click', () => { panel.style.display = 'none' })

  titleBar.appendChild(title)
  titleBar.appendChild(closeBtn)

  // ════════════════════════════════════════════════════════
  // 参数行
  // ════════════════════════════════════════════════════════
  const paramsRow = document.createElement('div')
  paramsRow.style.cssText = 'display:flex;gap:12px;align-items:center;'

  function makeField(
    label: string,
    value: number,
    step: number,
    unit: string,
  ): HTMLInputElement {
    const field = document.createElement('label')
    field.style.cssText = 'display:flex;align-items:center;gap:5px;white-space:nowrap;'

    const lbl = document.createElement('span')
    lbl.textContent = label
    lbl.style.cssText = 'font-size:11px;color:#aaa;'

    const input = document.createElement('input')
    input.type = 'number'
    input.value = String(value)
    input.step = String(step)
    input.style.cssText = [
      'width:52px',
      'padding:3px 5px',
      'font-size:12px',
      'color:#eee',
      'background:rgba(255,255,255,0.08)',
      'border:1px solid rgba(255,255,255,0.15)',
      'border-radius:4px',
      'outline:none',
    ].join(';')
    input.addEventListener('focus', () => { input.style.borderColor = 'rgba(255,255,255,0.35)' })
    input.addEventListener('blur', () => { input.style.borderColor = 'rgba(255,255,255,0.15)' })
    input.addEventListener('change', () => {
      settings.distance = Number(distInput.value)
      settings.lateral = Number(latInput.value)
      settings.vertical = Number(vertInput.value)
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        settings.distance = Number(distInput.value)
        settings.lateral = Number(latInput.value)
        settings.vertical = Number(vertInput.value)
      }
    })

    const u = document.createElement('span')
    u.textContent = unit
    u.style.cssText = 'font-size:10px;color:#777;'

    field.appendChild(lbl)
    field.appendChild(input)
    field.appendChild(u)
    paramsRow.appendChild(field)
    return input
  }

  distInput = makeField('前方', settings.distance, 1, 'm')
  latInput = makeField('横向', settings.lateral, 0.5, 'm')
  vertInput = makeField('垂直', settings.vertical, 0.5, 'm')

  // ════════════════════════════════════════════════════════
  // 操作行
  // ════════════════════════════════════════════════════════
  const actionsRow = document.createElement('div')
  actionsRow.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;'

  function makeBtn(text: string, title: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = text
    btn.title = title
    btn.style.cssText = [
      'padding:4px 10px',
      'font-size:11px',
      'font-weight:500',
      'color:#eee',
      `background:${color}`,
      'border:1px solid rgba(255,255,255,0.12)',
      'border-radius:4px',
      'cursor:pointer',
      'white-space:nowrap',
      'transition:background 0.15s',
    ].join(';')
    btn.addEventListener('mouseenter', () => { btn.style.filter = 'brightness(1.2)' })
    btn.addEventListener('mouseleave', () => { btn.style.filter = '' })
    btn.addEventListener('click', onClick)
    return btn
  }

  actionsRow.appendChild(makeBtn('▶ 左桨', '移动左螺旋桨到飞机前方', '#2d6a4f', () => onApply('left')))
  actionsRow.appendChild(makeBtn('▶ 右桨', '移动右螺旋桨到飞机前方', '#2d6a4f', () => onApply('right')))
  actionsRow.appendChild(makeBtn('▶ 双桨', '同时移动两个螺旋桨', '#1b6b50', () => onApply('both')))

  // ── 分隔 ──
  const div = document.createElement('span')
  div.style.cssText = 'width:1px;height:18px;background:rgba(255,255,255,0.15);margin:0 2px;align-self:center;'
  actionsRow.appendChild(div)

  // ── 预设标签 ──
  const presetLabel = document.createElement('span')
  presetLabel.textContent = '预设'
  presetLabel.style.cssText = 'font-size:10px;color:#777;white-space:nowrap;'
  actionsRow.appendChild(presetLabel)

  // ── 预设按钮 ──
  const presets: [string, number, number, number][] = [
    ['5m', 5, 0, 0],
    ['10m', 10, 0, 0],
    ['20m', 20, 0, 0],
    ['50m', 50, 0, 0],
    ['前上', 10, 0, 5],
    ['右侧', 10, 3, 0],
  ]

  for (const [label, d, lat, vert] of presets) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.textContent = label
    chip.title = `前${d}m 横${lat}m 竖${vert}m`
    chip.style.cssText = [
      'padding:2px 7px',
      'font-size:10px',
      'color:#bbb',
      'background:rgba(255,255,255,0.06)',
      'border:1px solid rgba(255,255,255,0.1)',
      'border-radius:10px',
      'cursor:pointer',
      'white-space:nowrap',
      'transition:background 0.15s',
    ].join(';')
    chip.addEventListener('mouseenter', () => { chip.style.background = 'rgba(255,255,255,0.14)' })
    chip.addEventListener('mouseleave', () => { chip.style.background = 'rgba(255,255,255,0.06)' })
    chip.addEventListener('click', () => {
      settings.distance = d
      settings.lateral = lat
      settings.vertical = vert
      distInput.value = String(d)
      latInput.value = String(lat)
      vertInput.value = String(vert)
    })
    actionsRow.appendChild(chip)
  }

  // ════════════════════════════════════════════════════════
  // 组装
  // ════════════════════════════════════════════════════════
  panel.appendChild(titleBar)
  panel.appendChild(paramsRow)
  panel.appendChild(actionsRow)

  container.style.position = 'relative'
  container.appendChild(panel)

  // ── API ──
  return {
    show() { panel.style.display = '' },
    hide() { panel.style.display = 'none' },
    getSettings() {
      return {
        distance: settings.distance,
        lateral: settings.lateral,
        vertical: settings.vertical,
      }
    },
    syncInputs(s: FrontSettings) {
      distInput.value = String(s.distance)
      latInput.value = String(s.lateral)
      vertInput.value = String(s.vertical)
    },
  }
}

// #endregion
