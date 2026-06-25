/**
 * toolbar-types — 工具栏状态类型定义
 */

import type * as Cesium from 'cesium'
import type { NodeAxesData, FrontSettings, FrontPanelAPI } from './types.ts'

/** viewer 扩展类型（mixin 注入的方法） */
export interface CesiumViewerExt extends Cesium.Viewer {
  applyNodeTransform(node: Cesium.ModelNode, t: Cesium.Cartesian3, hpr: Cesium.HeadingPitchRoll): void
  createNodeAxes(scene: Cesium.Scene, getter: () => Cesium.ModelNode | undefined): NodeAxesData
  updateAllAxes(): void
  moveNodeToTarget(node: Cesium.ModelNode, translation: Cesium.Cartesian3, model?: Cesium.Model): Cesium.Cartesian3
  moveNodeToFrontOfModel(node: Cesium.ModelNode, model: Cesium.Model, s: FrontSettings, translation: Cesium.Cartesian3): Cesium.Cartesian3
  targetPoint: Cesium.Entity
  nodeAxesVisible: boolean
}

/** 工具栏所需的所有可变状态 */
export interface ToolbarState {
  // viewer
  $v: CesiumViewerExt
  modelPromise: Promise<Cesium.Model>

  // 螺旋桨
  propAngularVelocity: number
  propDirection: number
  propAngle: number

  // 节点引用
  propL: Cesium.ModelNode | undefined
  propR: Cesium.ModelNode | undefined
  currentModel: Cesium.Model | undefined

  // 6-DOF
  translation: Cesium.Cartesian3
  extraRotation: Cesium.HeadingPitchRoll

  // UI
  frontPanel: FrontPanelAPI
  logTransform: (label: string) => void
}
