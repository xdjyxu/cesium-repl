/**
 * viewerNodeControlMixin — 模型节点控制插件
 *
 * 参考 air-stack /packages/gis-cesium/src/lib/core/plugins/ 约定：
 *   - 导出单一 mixin 函数，接收 viewer + options
 *   - 通过 Object.defineProperties 将方法挂载到 viewer 上
 *   - 内部辅助函数对模块私有
 *
 * 提供能力：
 *   1. 节点变换      — applyNodeTransform / getNodeWorldMatrix / worldDeltaToLocalDelta
 *   2. 坐标轴可视化  — createNodeAxes / updateAllAxes
 *   3. 标记点 & 移动 — moveNodeToTarget / moveNodeToFrontOfModel
 *
 * 🎯 使用方式:
 *   import { viewerNodeControlMixin } from './viewerNodeControlMixin.ts'
 *   viewerNodeControlMixin(viewer, { axisTargetPixels: 60 })
 *   // 之后即可调用 viewer.applyNodeTransform(...) 等方法
 */

import * as Cesium from 'cesium'
import type {
  ViewerNodeControlMixinOptions,
  NodeAxesData,
  FrontSettings,
} from './types.ts'

// ════════════════════════════════════════════════════════
// 1. 节点变换（纯数学）
// ════════════════════════════════════════════════════════

/**
 * 将 6-DOF 变换（平移 + 旋转）叠加到节点原始变换上。
 * 变换链: node.matrix = originalMatrix × [Translation × Rotation]
 */
function applyNodeTransform(
  node: Cesium.ModelNode,
  translation: Cesium.Cartesian3,
  hpr: Cesium.HeadingPitchRoll,
): void {
  const rot = Cesium.Matrix3.fromHeadingPitchRoll(hpr, new Cesium.Matrix3())
  const rt = Cesium.Matrix4.fromRotationTranslation(rot, translation, new Cesium.Matrix4())
  node.matrix = Cesium.Matrix4.multiply(node.originalMatrix, rt, new Cesium.Matrix4())
}

/**
 * 获取节点的世界矩阵（ECEF）。
 * worldMat = computedModelMatrix × computedTransform
 */
function getNodeWorldMatrix(
  node: Cesium.ModelNode,
  result: Cesium.Matrix4,
): Cesium.Matrix4 {
  const rt = (node as any)._runtimeNode as {
    sceneGraph?: { computedModelMatrix?: Cesium.Matrix4 }
    computedTransform?: Cesium.Matrix4
  } | undefined

  if (rt?.computedTransform && rt?.sceneGraph?.computedModelMatrix) {
    return Cesium.Matrix4.multiply(
      rt.sceneGraph.computedModelMatrix,
      rt.computedTransform,
      result,
    )
  }
  return Cesium.Matrix4.clone(Cesium.Matrix4.IDENTITY, result)
}

/**
 * 将世界空间偏移量转换为节点局部空间增量。
 *
 * 数学: Δt_local = R_our × inv(R_w) × Δw
 */
function worldDeltaToLocalDelta(
  node: Cesium.ModelNode,
  worldMat: Cesium.Matrix4,
  worldDelta: Cesium.Cartesian3,
  result: Cesium.Cartesian3,
): Cesium.Cartesian3 {
  const R_w = Cesium.Matrix4.getMatrix3(worldMat, new Cesium.Matrix3())
  const ourTransform = Cesium.Matrix4.multiply(
    Cesium.Matrix4.inverse(node.originalMatrix, new Cesium.Matrix4()),
    node.matrix,
    new Cesium.Matrix4(),
  )
  const R_our = Cesium.Matrix4.getMatrix3(ourTransform, new Cesium.Matrix3())

  const invR_w = Cesium.Matrix3.inverse(R_w, new Cesium.Matrix3())
  const temp = Cesium.Matrix3.multiplyByVector(invR_w, worldDelta, new Cesium.Cartesian3())
  return Cesium.Matrix3.multiplyByVector(R_our, temp, result)
}

// ════════════════════════════════════════════════════════
// 2. 坐标轴可视化
// ════════════════════════════════════════════════════════

const AXIS_COLORS = [Cesium.Color.RED, Cesium.Color.LIME, Cesium.Color.DODGERBLUE]
const AXIS_LABELS = ['X', 'Y', 'Z']

/** 根据相机距离计算世界空间长度，保证屏幕约 targetPixels 像素 */
function computeWorldLength(
  camera: Cesium.Camera,
  canvasHeight: number,
  worldPos: Cesium.Cartesian3,
  targetPixels: number,
): number {
  const distance = Cesium.Cartesian3.distance(camera.position, worldPos)
  let fovY: number = Math.PI / 3
  const frustum = camera.frustum as { fovy?: number }
  if (frustum.fovy !== undefined) {
    fovY = frustum.fovy
  }
  return distance * (targetPixels / canvasHeight) * 2 * Math.tan(fovY / 2)
}

function createNodeAxes(
  scene: Cesium.Scene,
  nodeGetter: () => Cesium.ModelNode | undefined,
): NodeAxesData {
  const lines = new Cesium.PolylineCollection()
  const labels = new Cesium.LabelCollection({ scene })
  const polylineRefs: any[] = []
  const labelRefs: Cesium.Label[] = []

  for (let i = 0; i < 3; i++) {
    polylineRefs.push(
      lines.add({
        positions: [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO],
        width: 3,
        material: Cesium.Material.fromType('Color', { color: AXIS_COLORS[i] }),
      }),
    )
    labelRefs.push(
      labels.add({
        position: Cesium.Cartesian3.ZERO,
        text: AXIS_LABELS[i],
        font: 'bold 14px monospace',
        fillColor: AXIS_COLORS[i],
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        scale: 0.8,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }),
    )
  }

  scene.primitives.add(lines)
  scene.primitives.add(labels)

  return { lines, labels, polylineRefs, labelRefs, nodeGetter }
}

function updateNodeAxes(
  data: NodeAxesData,
  camera: Cesium.Camera,
  canvasHeight: number,
  targetPixels: number,
  showAxes: boolean,
): void {
  const node = data.nodeGetter()
  if (!node || !showAxes) {
    data.lines.show = false
    data.labels.show = false
    return
  }

  data.lines.show = true
  data.labels.show = true

  const worldMat = getNodeWorldMatrix(node, new Cesium.Matrix4())
  const origin = Cesium.Matrix4.getTranslation(worldMat, new Cesium.Cartesian3())
  const rot = Cesium.Matrix4.getMatrix3(worldMat, new Cesium.Matrix3())
  const len = computeWorldLength(camera, canvasHeight, origin, targetPixels)

  for (let i = 0; i < 3; i++) {
    const raw = Cesium.Matrix3.getColumn(rot, i, new Cesium.Cartesian3())
    const dir = Cesium.Cartesian3.normalize(raw, new Cesium.Cartesian3())
    data.polylineRefs[i].positions = [
      origin,
      Cesium.Cartesian3.add(origin, Cesium.Cartesian3.multiplyByScalar(dir, len, new Cesium.Cartesian3()), new Cesium.Cartesian3()),
    ]
    data.labelRefs[i].position = Cesium.Cartesian3.add(
      origin,
      Cesium.Cartesian3.multiplyByScalar(dir, len * 1.1, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    )
  }
}

function updateAllAxes(
  allAxes: NodeAxesData[],
  camera: Cesium.Camera,
  canvasHeight: number,
  targetPixels: number,
  showAxes: boolean,
): void {
  for (const data of allAxes) {
    updateNodeAxes(data, camera, canvasHeight, targetPixels, showAxes)
  }
}

// ════════════════════════════════════════════════════════
// 3. 标记点 & 移动
// ════════════════════════════════════════════════════════

function createTargetPoint(viewer: Cesium.Viewer): Cesium.Entity {
  return viewer.entities.add({
    position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.ZERO),
    point: {
      pixelSize: 12,
      color: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: '目标',
      font: 'bold 14px sans-serif',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    show: false,
  })
}

/** 将节点移动到指定世界坐标 */
function moveNodeToWorldPosition(
  node: Cesium.ModelNode,
  targetWorldPos: Cesium.Cartesian3,
  translation: Cesium.Cartesian3,
): Cesium.Cartesian3 {
  const worldMat = getNodeWorldMatrix(node, new Cesium.Matrix4())
  const currentPos = Cesium.Matrix4.getTranslation(worldMat, new Cesium.Cartesian3())
  const worldDelta = Cesium.Cartesian3.subtract(targetWorldPos, currentPos, new Cesium.Cartesian3())
  const tDelta = worldDeltaToLocalDelta(node, worldMat, worldDelta, new Cesium.Cartesian3())

  translation.x += tDelta.x
  translation.y += tDelta.y
  translation.z += tDelta.z

  return tDelta
}

/** 计算模型前方指定偏移处的世界坐标 */
function computeFrontWorldPosition(
  model: Cesium.Model,
  settings: FrontSettings,
  result: Cesium.Cartesian3,
): Cesium.Cartesian3 {
  const modelCenter = Cesium.Matrix4.getTranslation(model.modelMatrix, new Cesium.Cartesian3())
  const modelRot = Cesium.Matrix4.getMatrix3(model.modelMatrix, new Cesium.Matrix3())

  const xDir = Cesium.Matrix3.getColumn(modelRot, 0, new Cesium.Cartesian3())
  const yDir = Cesium.Matrix3.getColumn(modelRot, 1, new Cesium.Cartesian3())
  const zDir = Cesium.Matrix3.getColumn(modelRot, 2, new Cesium.Cartesian3())

  result = Cesium.Cartesian3.clone(modelCenter, result)
  Cesium.Cartesian3.add(result, Cesium.Cartesian3.multiplyByScalar(xDir, settings.distance, new Cesium.Cartesian3()), result)
  Cesium.Cartesian3.add(result, Cesium.Cartesian3.multiplyByScalar(yDir, settings.lateral, new Cesium.Cartesian3()), result)
  Cesium.Cartesian3.add(result, Cesium.Cartesian3.multiplyByScalar(zDir, settings.vertical, new Cesium.Cartesian3()), result)

  return result
}

// ════════════════════════════════════════════════════════
// 4. Mixin 入口
// ════════════════════════════════════════════════════════

/**
 * 将模型节点控制能力注入 viewer。
 *
 * 使用方式：
 * ```ts
 * import { viewerNodeControlMixin } from './viewerNodeControlMixin.ts'
 *
 * const viewer = new Cesium.Viewer('cesiumContainer')
 * const ctrl = viewerNodeControlMixin(viewer, { axisTargetPixels: 60 })
 *
 * // 之后可直接调用 viewer 上的方法:
 * const axes = viewer.createNodeAxes(() => myNode)
 * viewer.applyNodeTransform(myNode, translation, hpr)
 * viewer.moveNodeToFrontOfModel(myNode, settings, translation)
 * ```
 */
export function viewerNodeControlMixin(
  viewer: Cesium.Viewer,
  options?: ViewerNodeControlMixinOptions,
) {
  const targetPixels = options?.axisTargetPixels ?? 60

  // ── 内部状态 ──
  const allAxes: NodeAxesData[] = []
  let showAxes = true
  const targetPoint = createTargetPoint(viewer)

  // ── Shift+Click 放置标记点 ──
  const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas)
  clickHandler.setInputAction(
    (movement: { position: Cesium.Cartesian2 }) => {
      const pos = viewer.scene.pickPosition(movement.position)
      if (Cesium.defined(pos)) {
        (targetPoint.position as Cesium.ConstantPositionProperty).setValue(pos as Cesium.Cartesian3)
        targetPoint.show = true
      }
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
    Cesium.KeyboardEventModifier.SHIFT,
  )

  // ═══════════════════════════════════════════
  // 挂载方法到 viewer
  // ═══════════════════════════════════════════

  Object.defineProperties(viewer, {
    // ── 节点变换 ──
    applyNodeTransform: {
      get() { return applyNodeTransform },
    },
    getNodeWorldMatrix: {
      get() { return getNodeWorldMatrix },
    },
    worldDeltaToLocalDelta: {
      get() { return worldDeltaToLocalDelta },
    },

    // ── 坐标轴 ──
    createNodeAxes: {
      value(scene: Cesium.Scene, nodeGetter: () => Cesium.ModelNode | undefined) {
        const data = createNodeAxes(scene, nodeGetter)
        allAxes.push(data)
        return data
      },
    },
    updateAllAxes: {
      value() {
        updateAllAxes(allAxes, viewer.camera, viewer.canvas.height, targetPixels, showAxes)
      },
    },

    // ── 标记点 & 移动 ──
    targetPoint: { get() { return targetPoint } },

    moveNodeToTarget: {
      value(node: Cesium.ModelNode, translation: Cesium.Cartesian3, model?: Cesium.Model) {
        if (!targetPoint.show && model) {
          const modelCenter = Cesium.Matrix4.getTranslation(model.modelMatrix, new Cesium.Cartesian3())
          const modelRot = Cesium.Matrix4.getMatrix3(model.modelMatrix, new Cesium.Matrix3())
          const xDir = Cesium.Matrix3.getColumn(modelRot, 0, new Cesium.Cartesian3())
          const pos = new Cesium.Cartesian3()
          Cesium.Cartesian3.add(modelCenter, Cesium.Cartesian3.multiplyByScalar(xDir, 100, new Cesium.Cartesian3()), pos)
          ;(targetPoint.position as Cesium.ConstantPositionProperty).setValue(pos)
          targetPoint.show = true
        }

        const targetPos = (targetPoint.position as Cesium.ConstantPositionProperty).getValue(
          new Cesium.JulianDate(),
        ) as Cesium.Cartesian3

        return moveNodeToWorldPosition(node, targetPos, translation)
      },
    },

    moveNodeToFrontOfModel: {
      value(node: Cesium.ModelNode, model: Cesium.Model, settings: FrontSettings, translation: Cesium.Cartesian3) {
        const targetWorldPos = computeFrontWorldPosition(model, settings, new Cesium.Cartesian3())
        const tDelta = moveNodeToWorldPosition(node, targetWorldPos, translation)

        // 更新标记点显示
        ;(targetPoint.position as Cesium.ConstantPositionProperty).setValue(targetWorldPos)
        targetPoint.show = true

        return tDelta
      },
    },

    computeFrontWorldPosition: {
      value(model: Cesium.Model, settings: FrontSettings, result?: Cesium.Cartesian3) {
        return computeFrontWorldPosition(model, settings, result ?? new Cesium.Cartesian3())
      },
    },

    // ── 坐标轴显隐 ──
    nodeAxesVisible: {
      get() { return showAxes },
      set(v: boolean) {
        showAxes = v
        for (const data of allAxes) {
          data.lines.show = v
          data.labels.show = v
        }
      },
    },
  })

  // 暴露 allAxes 引用供外部（如 updateAllAxes 需要在 preRender 调用）
  return {
    get allAxes() { return allAxes },
    get showAxes() { return showAxes },
    set showAxes(v: boolean) {
      showAxes = v
      for (const data of allAxes) {
        data.lines.show = v
        data.labels.show = v
      }
    },
  }
}

// 兼容旧导出
export { applyNodeTransform, getNodeWorldMatrix, worldDeltaToLocalDelta }
