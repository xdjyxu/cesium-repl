import * as Cesium from 'cesium'

import { viewerNodeControlMixin } from './viewerNodeControlMixin.ts'
import { createDefaultFrontSettings, createFrontSettingsPanel } from './node-front-panel.ts'
import { setupToolbar } from './toolbar.ts'
import type { NodeAxesData, FrontSettings } from './types.ts'
import type { CesiumViewerExt, ToolbarState } from './toolbar-types.ts'

/*
 * 🎯 模型节点控制演示
 *
 * viewerNodeControlMixin — 节点变换 / 坐标轴 / 标记点移动
 * setupToolbar          — Sandcastle 工具栏
 * 本文件仅负责场景编排与状态管理。
 */

// #region 场景与模型加载

const LON = 108.9402
const LAT = 34.2658
const ALT = 400

const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
})
viewer.scene.debugShowFramesPerSecond = true

const ctrl = viewerNodeControlMixin(viewer, { axisTargetPixels: 60 })
const $v = viewer as CesiumViewerExt

const MODEL_URL = '/models/Cesium_Air.glb'
const modelPosition = Cesium.Cartesian3.fromDegrees(LON, LAT, ALT)
const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(modelPosition)

const modelPromise = Cesium.Model.fromGltfAsync({
  url: MODEL_URL,
  modelMatrix,
  scale: 1,
  minimumPixelSize: 128,
})

// #endregion

// #region 状态

const state: ToolbarState = {
  $v,
  modelPromise,
  propAngularVelocity: Cesium.Math.toRadians(100 * 6),
  propDirection: 1,
  propAngle: 0,
  propL: undefined,
  propR: undefined,
  currentModel: undefined,
  translation: new Cesium.Cartesian3(),
  extraRotation: new Cesium.HeadingPitchRoll(),
  frontPanel: undefined!,
  logTransform(label) {
    const roll = state.propAngle % (Math.PI * 2)
    console.log(
      `[${label}] `
      + `平移: [${state.translation.x.toFixed(2)}, ${state.translation.y.toFixed(2)}, ${state.translation.z.toFixed(2)}] | `
      + `heading: ${Cesium.Math.toDegrees(state.extraRotation.heading).toFixed(1)}° | `
      + `pitch: ${Cesium.Math.toDegrees(state.extraRotation.pitch).toFixed(1)}° | `
      + `roll(spin): ${Cesium.Math.toDegrees(roll).toFixed(1)}°`,
    )
  },
}

const allAxes: NodeAxesData[] = []

// 便于内部访问的别名
const { translation, extraRotation } = state

// #endregion

// #region 键盘控制

const STEP_TRANSLATE = 0.05
const STEP_TRANSLATE_FAST = 0.5
const STEP_ROTATE = Cesium.Math.toRadians(2)

viewer.canvas.setAttribute('tabindex', '0')
viewer.canvas.style.outline = 'none'

window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  const fast = e.shiftKey
  const dt = fast ? STEP_TRANSLATE_FAST : STEP_TRANSLATE

  switch (e.key) {
    case 'w': translation.x += dt; break
    case 's': translation.x -= dt; break
    case 'a': translation.y -= dt; break
    case 'd': translation.y += dt; break
    case 'q': translation.z -= dt; break
    case 'e': translation.z += dt; break

    case 'ArrowLeft': extraRotation.heading -= STEP_ROTATE; break
    case 'ArrowRight': extraRotation.heading += STEP_ROTATE; break
    case 'ArrowUp': extraRotation.pitch += STEP_ROTATE; break
    case 'ArrowDown': extraRotation.pitch -= STEP_ROTATE; break

    case ',': extraRotation.roll -= STEP_ROTATE; break
    case '.': extraRotation.roll += STEP_ROTATE; break

    case 'r':
      if (e.ctrlKey || e.metaKey) break
      translation.x = 0; translation.y = 0; translation.z = 0
      extraRotation.heading = 0; extraRotation.pitch = 0; extraRotation.roll = 0
      state.propAngle = 0
      state.logTransform('reset')
      break

    default: return
  }
  e.preventDefault()
  state.logTransform('keyboard')
})

viewer.canvas.addEventListener('click', () => { viewer.canvas.focus() })

// #endregion

// #region 每帧更新

let lastWallTime = performance.now()
viewer.scene.preRender.addEventListener(() => {
  if (!state.propL || !state.propR) return

  const now = performance.now()
  const dt = Math.min((now - lastWallTime) / 1000, 0.1)
  lastWallTime = now

  state.propAngle += state.propAngularVelocity * state.propDirection * dt

  const hpr = new Cesium.HeadingPitchRoll(
    extraRotation.heading,
    extraRotation.pitch,
    extraRotation.roll + state.propAngle,
  )

  $v.applyNodeTransform(state.propL, translation, hpr)
  $v.applyNodeTransform(state.propR, translation, hpr)
  $v.updateAllAxes()
})

// #endregion

// #region 飞机前方设置

const frontSettings: FrontSettings = createDefaultFrontSettings()

const frontPanel = createFrontSettingsPanel(
  document.getElementById('cesiumContainer')!,
  frontSettings,
  (target) => {
    if (!state.currentModel) return
    if (target === 'left' || target === 'both') {
      $v.moveNodeToFrontOfModel(state.propL!, state.currentModel, frontSettings, translation)
      state.logTransform('move-to-front')
    }
    if (target === 'right' || target === 'both') {
      $v.moveNodeToFrontOfModel(state.propR!, state.currentModel, frontSettings, translation)
      state.logTransform('move-to-front')
    }
  },
)

state.frontPanel = frontPanel

// #endregion

// #region 工具栏

setupToolbar(state)

// #endregion

// #region 模型加载

modelPromise.then((model) => {
  viewer.scene.primitives.add(model)
  state.currentModel = model

  model.readyEvent.addEventListener(() => {
    state.propL = model.getNode('Prop')
    state.propR = model.getNode('Prop__2_')

    allAxes.push($v.createNodeAxes(viewer.scene, () => state.propL!))
    allAxes.push($v.createNodeAxes(viewer.scene, () => state.propR!))

    const tilt = Cesium.Matrix4.fromRotationTranslation(
      Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(-10), new Cesium.Matrix3()),
      Cesium.Cartesian3.ZERO,
      new Cesium.Matrix4(),
    )
    Cesium.Matrix4.multiply(modelMatrix, tilt, model.modelMatrix)
  })
})

// #endregion

// #region 视角

modelPromise.then((model) => {
  // 模型 scale=1 时很小，需要近距离观察
  const center = Cesium.Matrix4.getTranslation(model.modelMatrix, new Cesium.Cartesian3())
  const boundingSphere = new Cesium.BoundingSphere(center, 30)
  viewer.camera.flyToBoundingSphere(boundingSphere, {
    duration: 1.5,
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-25), 60),
  })
})

// #endregion
