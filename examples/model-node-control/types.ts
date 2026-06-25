/**
 * model-node-control 类型定义
 *
 * 遵循 air-stack Cesium 插件约定：
 *   - MixinOptions 接口以 "Viewer...MixinOptions" 命名
 *   - 所有接口在此集中定义
 */

import type * as Cesium from 'cesium'

// #region Mixin 配置

export interface ViewerNodeControlMixinOptions {
  /** 坐标轴目标屏幕像素大小，默认 60 */
  axisTargetPixels?: number
}

// #endregion

// #region 坐标轴可视化

export interface NodeAxesData {
  lines: Cesium.PolylineCollection
  labels: Cesium.LabelCollection
  polylineRefs: any[] // Polyline[]
  labelRefs: Cesium.Label[]
  nodeGetter: () => Cesium.ModelNode | undefined
}

// #endregion

// #region 飞机前方设置

export interface FrontSettings {
  /** 前方距离（米） */
  distance: number
  /** 横向偏移（正=右，米） */
  lateral: number
  /** 垂直偏移（正=上，米） */
  vertical: number
}

/** 面板控制 API */
export interface FrontPanelAPI {
  show(): void
  hide(): void
  getSettings(): FrontSettings
  syncInputs(settings: FrontSettings): void
}

/** 应用回调：点击移动按钮时调用 */
export type ApplyCallback = (target: 'left' | 'right' | 'both') => void

// #endregion
