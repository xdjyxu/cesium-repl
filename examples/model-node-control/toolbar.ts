/**
 * toolbar — 示例工具栏配置
 *
 * 纯 Sandcastle.addToolbarMenu / addToggleButton 调用，
 * 所有状态通过参数注入，本文件不持有任何可变状态。
 */

import Sandcastle from 'Sandcastle'
import * as Cesium from 'cesium'
import type { CesiumViewerExt, ToolbarState } from './toolbar-types.ts'

/** 构建完整的工具栏 */
export function setupToolbar(state: ToolbarState): void {
  const { $v, modelPromise, frontPanel, logTransform } = state

  // ── 螺旋桨转速 ──
  Sandcastle.addToolbarMenu([
    { text: '⏹ 停止', onselect: () => { state.propAngularVelocity = 0 } },
    { text: '🐢 慢速 100 RPM', onselect: () => { state.propAngularVelocity = Cesium.Math.toRadians(100 * 6) } },
    { text: '✈ 巡航 800 RPM', onselect: () => { state.propAngularVelocity = Cesium.Math.toRadians(800 * 6) } },
    { text: '🚀 高速 2000 RPM', onselect: () => { state.propAngularVelocity = Cesium.Math.toRadians(2000 * 6) } },
  ])

  // ── 旋转方向 ──
  Sandcastle.addToolbarMenu([
    { text: '↻ 正转', onselect: () => { state.propDirection = 1 } },
    { text: '↺ 反转', onselect: () => { state.propDirection = -1 } },
  ])

  // ── 六自由度平移步进 ──
  Sandcastle.addToolbarMenu([
    { text: '→ +X (前)', onselect: () => { state.translation.x += 0.1; logTransform('toolbar') } },
    { text: '← -X (后)', onselect: () => { state.translation.x -= 0.1; logTransform('toolbar') } },
    { text: '↑ +Y (右)', onselect: () => { state.translation.y += 0.1; logTransform('toolbar') } },
    { text: '↓ -Y (左)', onselect: () => { state.translation.y -= 0.1; logTransform('toolbar') } },
    { text: '⬆ +Z (上)', onselect: () => { state.translation.z += 0.1; logTransform('toolbar') } },
    { text: '⬇ -Z (下)', onselect: () => { state.translation.z -= 0.1; logTransform('toolbar') } },
  ])

  // ── 移动到标记点 ──
  Sandcastle.addToolbarMenu([
    {
      text: '📍 左桨 → 标记点',
      onselect: () => {
        $v.moveNodeToTarget(state.propL!, state.translation, state.currentModel)
        logTransform('move-to-point')
      },
    },
    {
      text: '📍 右桨 → 标记点',
      onselect: () => {
        $v.moveNodeToTarget(state.propR!, state.translation, state.currentModel)
        logTransform('move-to-point')
      },
    },
  ])

  // ── 重置 ──
  Sandcastle.addToolbarMenu([
    {
      text: '🔄 重置 6-DOF',
      onselect: () => {
        state.translation.x = 0; state.translation.y = 0; state.translation.z = 0
        state.extraRotation.heading = 0; state.extraRotation.pitch = 0; state.extraRotation.roll = 0
        state.propAngle = 0
        $v.targetPoint.show = false
        logTransform('reset')
      },
    },
  ])

  // ── 开关 ──
  Sandcastle.addToggleButton('显示包围盒', false, (checked) => {
    modelPromise.then(m => { m.debugShowBoundingVolume = checked })
  })

  Sandcastle.addToggleButton('显示节点坐标轴', true, (checked) => {
    $v.nodeAxesVisible = checked
  })

  Sandcastle.addToggleButton('✈ 飞机前方设置', true, (checked) => {
    checked ? frontPanel.show() : frontPanel.hide()
  })
}
