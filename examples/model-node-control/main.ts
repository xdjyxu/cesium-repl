import * as Cesium from 'cesium'
import Sandcastle from 'Sandcastle'

// #region 场景与模型加载

// 西安钟楼附近上空（与 antenna-pattern 示例同坐标，便于对比）
const LON = 108.9402
const LAT = 34.2658
const ALT = 5000

const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
})

viewer.scene.debugShowFramesPerSecond = true

// Cesium_Air.glb 节点结构（加载后用 model.getNode(name) 获取）：
//   - "Prop"      左螺旋桨，translation [1.92, -0.68, -3.41]
//   - "Prop__2_"  右螺旋桨，translation [1.92, -0.68, +3.41]
// 叶片绕机身 X 轴（机头方向）旋转
// 模型放在 public/models/ 下本地提供，避免 sandcastle.cesium.com 跨域限制
const MODEL_URL = '/models/Cesium_Air.glb'

const modelPosition = Cesium.Cartesian3.fromDegrees(LON, LAT, ALT)
const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(modelPosition)

const modelPromise = Cesium.Model.fromGltfAsync({
  url: MODEL_URL,
  modelMatrix,
  scale: 200, // 原模型很小，放大到可视尺寸
  minimumPixelSize: 128,
})

// #endregion

// #region 六自由度节点控制

// ── 状态 ──────────────────────────────────────────────

/** 螺旋桨角速度（弧度/秒），0 = 停止 */
let propAngularVelocity = Cesium.Math.toRadians(100 * 6) // 默认 100 RPM
/** 旋转方向：+1 正转 / -1 反转 */
let propDirection = 1
/** 累计螺旋桨自旋角度（弧度）—— 对应 HeadingPitchRoll.roll（绕 X 轴） */
let propAngle = 0

/** 左/右螺旋桨节点引用 */
let propL: Cesium.ModelNode | undefined
let propR: Cesium.ModelNode | undefined
/** 模型引用（坐标轴更新需要） */
let currentModel: Cesium.Model | undefined

/**
 * 6-DOF 平移偏移（模型空间，米）。
 * X = 机头方向（螺旋桨自旋轴），Y = 机身右侧，Z = 机身上方。
 */
const translation = new Cesium.Cartesian3()

/**
 * 额外旋转角度（弧度），不含螺旋桨自旋。
 * heading: 绕 Z 轴（上方向），pitch: 绕 Y 轴（右侧），roll: 绕 X 轴（自旋单独累计）。
 */
const extraRotation = new Cesium.HeadingPitchRoll()

/** 坐标轴是否可见 */
let showAxes = true
/** 坐标轴线集合（PolylineCollection） */
let axisLines: Cesium.PolylineCollection | undefined
/** 坐标轴标签集合（LabelCollection） */
let axisLabels: Cesium.LabelCollection | undefined
/** 轴线引用，用于每帧更新位置 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const axisPolylineRefs: any[] = []
/** 轴标签订义，用于每帧更新位置 */
const axisLabelDefs: { label: Cesium.Label; axisIndex: number }[] = []

// ── 核心变换函数 ─────────────────────────────────────

/**
 * 将 6-DOF 变换（平移 + 旋转）叠加到节点原始变换上。
 *
 * 旋转采用 HeadingPitchRoll 约定：
 *   - heading: 绕 Z 轴（模型上方向）
 *   - pitch:   绕 Y 轴（模型右侧）
 *   - roll:    绕 X 轴（模型前方）—— 螺旋桨自旋用
 *
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

// ── 坐标轴可视化（PolylineCollection + LabelCollection） ──

/**
 * 计算节点的世界矩阵（含模型缩放）。
 *
 * 变换链: world = modelMatrix × Scale × nodeLocalMatrix
 * 缩放只影响平移分量；旋转分量不受缩放影响（方向归一化后一致）。
 */
function getNodeWorldMatrix(
  model: Cesium.Model,
  node: Cesium.ModelNode,
  result: Cesium.Matrix4,
): Cesium.Matrix4 {
  const scale = model.scale
  const localTrans = Cesium.Matrix4.getTranslation(node.matrix, new Cesium.Cartesian3())
  const scaledTrans = Cesium.Cartesian3.multiplyByScalar(localTrans, scale, new Cesium.Cartesian3())
  const worldTrans = Cesium.Matrix4.multiplyByPoint(model.modelMatrix, scaledTrans, new Cesium.Cartesian3())

  const localRot = Cesium.Matrix4.getMatrix3(node.matrix, new Cesium.Matrix3())
  const modelRot = Cesium.Matrix4.getMatrix3(model.modelMatrix, new Cesium.Matrix3())
  const worldRot = Cesium.Matrix3.multiply(modelRot, localRot, new Cesium.Matrix3())

  return Cesium.Matrix4.fromRotationTranslation(worldRot, worldTrans, result)
}

/**
 * 根据相机距离计算世界空间轴长，保证屏幕空间约 targetPixels 像素。
 */
function computeAxisLength(worldPos: Cesium.Cartesian3, targetPixels: number = 60): number {
  const distance = Cesium.Cartesian3.distance(viewer.camera.position, worldPos)
  const canvasHeight = viewer.canvas.height
  let fovY = Math.PI / 3 // 默认 60°
  const frustum = viewer.camera.frustum as { fovy?: number }
  if (frustum.fovy !== undefined) {
    fovY = frustum.fovy
  }
  return distance * (targetPixels / canvasHeight) * 2 * Math.tan(fovY / 2)
}

/**
 * 为指定节点创建坐标轴可视化。
 *
 * 使用 PolylineCollection 绘制轴线、LabelCollection 放置轴标签，
 * 每帧在 preRender 中手动更新位置——比 Entity + CallbackProperty 更可靠。
 */
function createNodeAxes(
  scene: Cesium.Scene,
  model: Cesium.Model,
  nodeGetter: () => Cesium.ModelNode | undefined,
): { lines: Cesium.PolylineCollection; labels: Cesium.LabelCollection } {
  const lineColors = [Cesium.Color.RED, Cesium.Color.LIME, Cesium.Color.DODGERBLUE]
  const labelTexts = ['X', 'Y', 'Z']

  const lines = new Cesium.PolylineCollection()
  const labels = new Cesium.LabelCollection({ scene })

  for (let i = 0; i < 3; i++) {
    // 占位位置，会在 preRender 中更新
    const placeholder = Cesium.Cartesian3.ZERO

    const polyline = lines.add({
      positions: [placeholder, placeholder],
      width: 3,
      material: Cesium.Material.fromType('Color', { color: lineColors[i] }),
    })
    axisPolylineRefs.push(polyline)

    const label = labels.add({
      position: placeholder,
      text: labelTexts[i],
      font: 'bold 14px monospace',
      fillColor: lineColors[i],
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      scale: 0.8,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: true,
    })
    axisLabelDefs.push({ label, axisIndex: i })
  }

  scene.primitives.add(lines)
  scene.primitives.add(labels)

  return { lines, labels }
}

/**
 * 每帧更新坐标轴的位置和朝向。
 */
function updateAxes(
  model: Cesium.Model,
  nodeGetter: () => Cesium.ModelNode | undefined,
): void {
  if (!showAxes || !axisLines) {
    if (axisLines) axisLines.show = false
    if (axisLabels) axisLabels.show = false
    return
  }

  const node = nodeGetter()
  if (!node) {
    axisLines.show = false
    axisLabels.show = false
    return
  }

  axisLines.show = true
  axisLabels.show = true

  const worldMat = getNodeWorldMatrix(model, node, new Cesium.Matrix4())
  const origin = Cesium.Matrix4.getTranslation(worldMat, new Cesium.Cartesian3())
  const rot = Cesium.Matrix4.getMatrix3(worldMat, new Cesium.Matrix3())

  const length = computeAxisLength(origin)

  // 更新三根轴线
  for (let i = 0; i < axisPolylineRefs.length; i++) {
    const dir = Cesium.Matrix3.getColumn(rot, i, new Cesium.Cartesian3())
    const end = new Cesium.Cartesian3()
    Cesium.Cartesian3.add(
      origin,
      Cesium.Cartesian3.multiplyByScalar(dir, length, new Cesium.Cartesian3()),
      end,
    )
    axisPolylineRefs[i].positions = [origin, end]
  }

  // 更新轴标签
  for (const { label, axisIndex } of axisLabelDefs) {
    const dir = Cesium.Matrix3.getColumn(rot, axisIndex, new Cesium.Cartesian3())
    const tip = new Cesium.Cartesian3()
    Cesium.Cartesian3.add(
      origin,
      Cesium.Cartesian3.multiplyByScalar(dir, length * 1.1, new Cesium.Cartesian3()),
      tip,
    )
    label.position = tip
  }
}

// ── 调试输出 ─────────────────────────────────────────

function logTransform(label: string): void {
  const roll = propAngle % (Math.PI * 2)
  console.log(
    `[${label}] ` +
    `平移: [${translation.x.toFixed(2)}, ${translation.y.toFixed(2)}, ${translation.z.toFixed(2)}] | ` +
    `heading: ${Cesium.Math.toDegrees(extraRotation.heading).toFixed(1)}° | ` +
    `pitch: ${Cesium.Math.toDegrees(extraRotation.pitch).toFixed(1)}° | ` +
    `roll(spin): ${Cesium.Math.toDegrees(roll).toFixed(1)}°`,
  )
}

// ── 键盘控制（六自由度）───────────────────────────────

const STEP_TRANSLATE = 0.05 // 米/次（微调）
const STEP_TRANSLATE_FAST = 0.5 // 米/次（Shift 加速）
const STEP_ROTATE = Cesium.Math.toRadians(2) // 弧度/次

document.addEventListener('keydown', (e) => {
  // 焦点在输入框时跳过
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  const fast = e.shiftKey
  const dt = fast ? STEP_TRANSLATE_FAST : STEP_TRANSLATE

  switch (e.key) {
    // ── 平移：WASD + QE ──
    case 'w': translation.x += dt; break
    case 's': translation.x -= dt; break
    case 'a': translation.y -= dt; break
    case 'd': translation.y += dt; break
    case 'q': translation.z -= dt; break
    case 'e': translation.z += dt; break

    // ── 旋转：方向键 ──
    case 'ArrowLeft':  extraRotation.heading -= STEP_ROTATE; break
    case 'ArrowRight': extraRotation.heading += STEP_ROTATE; break
    case 'ArrowUp':    extraRotation.pitch += STEP_ROTATE; break
    case 'ArrowDown':  extraRotation.pitch -= STEP_ROTATE; break

    // ── 绕 X 轴额外旋转（非自旋）：逗号/句号 ──
    case ',': extraRotation.roll -= STEP_ROTATE; break
    case '.': extraRotation.roll += STEP_ROTATE; break

    // ── 重置所有变换 ──
    case 'r':
      if (e.ctrlKey || e.metaKey) break // 保留浏览器刷新快捷键
      translation.x = 0; translation.y = 0; translation.z = 0
      extraRotation.heading = 0; extraRotation.pitch = 0; extraRotation.roll = 0
      propAngle = 0
      logTransform('reset')
      break

    default: return
  }

  e.preventDefault()
  logTransform('keyboard')
})

// ── 每帧更新 ─────────────────────────────────────────

let lastWallTime = performance.now()
viewer.scene.preRender.addEventListener(() => {
  if (!propL || !propR) return

  const now = performance.now()
  const dt = Math.min((now - lastWallTime) / 1000, 0.1) // 上限 100ms，防止切后台后突变
  lastWallTime = now

  // 累计螺旋桨自旋角度
  propAngle += propAngularVelocity * propDirection * dt

  // 合并额外旋转 + 自旋：HeadingPitchRoll(heading, pitch, roll)
  const hpr = new Cesium.HeadingPitchRoll(
    extraRotation.heading,
    extraRotation.pitch,
    extraRotation.roll + propAngle,
  )

  applyNodeTransform(propL, translation, hpr)
  applyNodeTransform(propR, translation, hpr)

  // 更新节点坐标轴（需要 model 引用，从外部捕获）
  updateAxes(currentModel!, () => propL)
})

// ── 模型加载与初始化 ─────────────────────────────────

modelPromise.then((model) => {
  viewer.scene.primitives.add(model)
  currentModel = model

  model.readyEvent.addEventListener(() => {
    propL = model.getNode('Prop')
    propR = model.getNode('Prop__2_')

    // 为左螺旋桨节点创建局部坐标轴（PolylineCollection + LabelCollection）
    const axes = createNodeAxes(viewer.scene, model, () => propL)
    axisLines = axes.lines
    axisLabels = axes.labels

    // 略带俯仰，便于同时看到两侧螺旋桨
    const tilt = Cesium.Matrix4.fromRotationTranslation(
      Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(-10), new Cesium.Matrix3()),
      Cesium.Cartesian3.ZERO,
      new Cesium.Matrix4(),
    )
    Cesium.Matrix4.multiply(modelMatrix, tilt, model.modelMatrix)
  })
})

// #endregion

// #region 工具栏

// ── 螺旋桨转速 ──
Sandcastle.addToolbarMenu([
  { text: '⏹ 停止', onselect: () => { propAngularVelocity = 0 } },
  { text: '🐢 慢速 100 RPM', onselect: () => { propAngularVelocity = Cesium.Math.toRadians(100 * 6) } },
  { text: '✈ 巡航 800 RPM', onselect: () => { propAngularVelocity = Cesium.Math.toRadians(800 * 6) } },
  { text: '🚀 高速 2000 RPM', onselect: () => { propAngularVelocity = Cesium.Math.toRadians(2000 * 6) } },
])

Sandcastle.addToolbarMenu([
  { text: '↻ 正转', onselect: () => { propDirection = 1 } },
  { text: '↺ 反转', onselect: () => { propDirection = -1 } },
])

// ── 六自由度：平移步进 ──
Sandcastle.addToolbarMenu([
  { text: '→ +X (前)', onselect: () => { translation.x += 0.1; logTransform('toolbar') } },
  { text: '← -X (后)', onselect: () => { translation.x -= 0.1; logTransform('toolbar') } },
  { text: '↑ +Y (右)', onselect: () => { translation.y += 0.1; logTransform('toolbar') } },
  { text: '↓ -Y (左)', onselect: () => { translation.y -= 0.1; logTransform('toolbar') } },
  { text: '⬆ +Z (上)', onselect: () => { translation.z += 0.1; logTransform('toolbar') } },
  { text: '⬇ -Z (下)', onselect: () => { translation.z -= 0.1; logTransform('toolbar') } },
])

// ── 六自由度：重置 ──
Sandcastle.addToolbarMenu([
  {
    text: '🔄 重置 6-DOF',
    onselect: () => {
      translation.x = 0; translation.y = 0; translation.z = 0
      extraRotation.heading = 0; extraRotation.pitch = 0; extraRotation.roll = 0
      propAngle = 0
      logTransform('reset')
    },
  },
])

Sandcastle.addToggleButton('显示包围盒', false, (checked: boolean) => {
  modelPromise.then(model => { model.debugShowBoundingVolume = checked })
})

Sandcastle.addToggleButton('显示节点坐标轴', true, (checked: boolean) => {
  showAxes = checked
  if (axisLines) axisLines.show = checked
  if (axisLabels) axisLabels.show = checked
})

// #endregion

// #region 视角

// 视角定位到模型斜后方
modelPromise.then(() => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(LON, LAT, ALT + 800),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-15),
      roll: 0,
    },
  })
})

// #endregion
