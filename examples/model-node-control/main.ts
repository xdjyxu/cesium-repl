import * as Cesium from 'cesium'

// #region 场景与模型加载

// 西安钟楼附近上空（与 antenna-pattern 示例同坐标，便于对比）
const LON = 108.9402
const LAT = 34.2658
const ALT = 1050

const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
})

viewer.scene.debugShowFramesPerSecond = true

// Cesium_Air.glb 节点结构（加载后用 model.getNode(name) 获取）：
//   - "Prop"      左螺旋桨，translation [1.92, -0.68, -3.41]
//   - "Prop__2_"  右螺旋桨，translation [1.92, -0.68, +3.41]
// 叶片绕机身 X 轴（机头方向）旋转
// 通过 /sampleData 代理到 Cesium GitHub raw，避免本地存储模型文件
const MODEL_URL = '/sampleData/models/CesiumAir/Cesium_Air.glb'

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
/** 模型引用（标记点放置需要） */
let currentModel: Cesium.Model | undefined

/**
 * 6-DOF 平移偏移（模型空间）。
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

// ── 节点世界矩阵（参考内部 API）─────────────────────────

/**
 * 获取节点的世界矩阵（ECEF）。
 *
 * 使用 Cesium 内部运行时数据：
 *   - _runtimeNode.sceneGraph.computedModelMatrix  → modelMatrix × diag(scale)
 *   - _runtimeNode.computedTransform              → 沿父链组合到根的完整节点变换
 *
 * worldMat = computedModelMatrix × computedTransform
 *
 * 相比手动拼接 modelMatrix × scale × node.matrix：
 *   ✓ 已包含模型缩放
 *   ✓ 已沿 glTF 父链组合所有祖先变换
 *   ✓ 与渲染管线使用的矩阵完全一致
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

  // 降级：内部 API 不可用时返回单位阵
  return Cesium.Matrix4.clone(Cesium.Matrix4.IDENTITY, result)
}

// ── 坐标轴可视化 ─────────────────────────────────────

/** 单个节点的坐标轴数据 */
interface NodeAxesData {
  lines: Cesium.PolylineCollection
  labels: Cesium.LabelCollection
  polylineRefs: any[] // Polyline[]
  labelRefs: Cesium.Label[]
  nodeGetter: () => Cesium.ModelNode | undefined
}

/** 所有节点的坐标轴 */
const allAxes: NodeAxesData[] = []

/**
 * 根据相机距离计算世界空间长度，保证屏幕约 targetPixels 像素。
 */
function computeWorldLength(worldPos: Cesium.Cartesian3, targetPixels: number = 60): number {
  const distance = Cesium.Cartesian3.distance(viewer.camera.position, worldPos)
  const canvasHeight = viewer.canvas.height
  let fovY = Math.PI / 3
  const frustum = viewer.camera.frustum as { fovy?: number }
  if (frustum.fovy !== undefined) {
    fovY = frustum.fovy
  }
  return distance * (targetPixels / canvasHeight) * 2 * Math.tan(fovY / 2)
}

function createNodeAxes(
  scene: Cesium.Scene,
  nodeGetter: () => Cesium.ModelNode | undefined,
): NodeAxesData {
  const lineColors = [Cesium.Color.RED, Cesium.Color.LIME, Cesium.Color.DODGERBLUE]
  const labelTexts = ['X', 'Y', 'Z']

  const lines = new Cesium.PolylineCollection()
  const labels = new Cesium.LabelCollection({ scene })
  const polylineRefs: any[] = []
  const labelRefs: Cesium.Label[] = []

  for (let i = 0; i < 3; i++) {
    const placeholder = Cesium.Cartesian3.ZERO

    const polyline = lines.add({
      positions: [placeholder, placeholder],
      width: 3,
      material: Cesium.Material.fromType('Color', { color: lineColors[i] }),
    })
    polylineRefs.push(polyline)

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
    })
    labelRefs.push(label)
  }

  scene.primitives.add(lines)
  scene.primitives.add(labels)

  return { lines, labels, polylineRefs, labelRefs, nodeGetter }
}

/**
 * 每帧更新单个节点的坐标轴——直接在世界空间（ECEF）设置 polyline 位置。
 */
function updateNodeAxes(data: NodeAxesData): void {
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

  const worldLength = computeWorldLength(origin)

  for (let i = 0; i < 3; i++) {
    const raw = Cesium.Matrix3.getColumn(rot, i, new Cesium.Cartesian3())
    const dir = Cesium.Cartesian3.normalize(raw, new Cesium.Cartesian3())
    const end = new Cesium.Cartesian3()
    Cesium.Cartesian3.add(
      origin,
      Cesium.Cartesian3.multiplyByScalar(dir, worldLength, new Cesium.Cartesian3()),
      end,
    )
    data.polylineRefs[i].positions = [origin, end]
  }

  for (let i = 0; i < 3; i++) {
    const raw = Cesium.Matrix3.getColumn(rot, i, new Cesium.Cartesian3())
    const dir = Cesium.Cartesian3.normalize(raw, new Cesium.Cartesian3())
    const tip = new Cesium.Cartesian3()
    Cesium.Cartesian3.add(
      origin,
      Cesium.Cartesian3.multiplyByScalar(dir, worldLength * 1.1, new Cesium.Cartesian3()),
      tip,
    )
    data.labelRefs[i].position = tip
  }
}

function updateAllAxes(): void {
  for (const data of allAxes) {
    updateNodeAxes(data)
  }
}

// ── 调试输出 ─────────────────────────────────────────

function logTransform(label: string): void {
  const roll = propAngle % (Math.PI * 2)
  console.log(
    `[${label}] `
    + `平移: [${translation.x.toFixed(2)}, ${translation.y.toFixed(2)}, ${translation.z.toFixed(2)}] | `
    + `heading: ${Cesium.Math.toDegrees(extraRotation.heading).toFixed(1)}° | `
    + `pitch: ${Cesium.Math.toDegrees(extraRotation.pitch).toFixed(1)}° | `
    + `roll(spin): ${Cesium.Math.toDegrees(roll).toFixed(1)}°`,
  )
}

// ── 键盘控制（六自由度）───────────────────────────────

const STEP_TRANSLATE = 0.05
const STEP_TRANSLATE_FAST = 0.5
const STEP_ROTATE = Cesium.Math.toRadians(2)

viewer.canvas.setAttribute('tabindex', '0')
viewer.canvas.style.outline = 'none'

window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
    return

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
      if (e.ctrlKey || e.metaKey)
        break
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

viewer.canvas.addEventListener('click', () => {
  viewer.canvas.focus()
})

// ── 每帧更新 ─────────────────────────────────────────

let lastWallTime = performance.now()
viewer.scene.preRender.addEventListener(() => {
  if (!propL || !propR)
    return

  const now = performance.now()
  const dt = Math.min((now - lastWallTime) / 1000, 0.1)
  lastWallTime = now

  propAngle += propAngularVelocity * propDirection * dt

  const hpr = new Cesium.HeadingPitchRoll(
    extraRotation.heading,
    extraRotation.pitch,
    extraRotation.roll + propAngle,
  )

  applyNodeTransform(propL, translation, hpr)
  applyNodeTransform(propR, translation, hpr)

  updateAllAxes()
})

// #endregion

// #region 标记点 & 移动节点到点

/**
 * 标记点 Entity。
 * - Shift+Click 手动放置到点击位置
 * - 直接点「移动」按钮时，未放置则自动放到模型附近（100m 偏移）
 */
const targetPoint = viewer.entities.add({
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

/** 将标记点放到模型附近（模型中心 + 100m 向 X 偏移） */
function placeTargetNearModel(): void {
  if (!currentModel)
    return
  const modelCenter = Cesium.Matrix4.getTranslation(
    currentModel.modelMatrix,
    new Cesium.Cartesian3(),
  )
  const modelRot = Cesium.Matrix4.getMatrix3(
    currentModel.modelMatrix,
    new Cesium.Matrix3(),
  )
  // 模型前方（X轴）100m
  const xDir = Cesium.Matrix3.getColumn(modelRot, 0, new Cesium.Cartesian3())
  const pos = new Cesium.Cartesian3()
  Cesium.Cartesian3.add(
    modelCenter,
    Cesium.Cartesian3.multiplyByScalar(xDir, 100, new Cesium.Cartesian3()),
    pos,
  )
  ;(targetPoint.position as Cesium.ConstantPositionProperty).setValue(pos)
  targetPoint.show = true
  const carto = Cesium.Cartographic.fromCartesian(pos)
  console.log(
    `[point] 标记点(自动): lon ${Cesium.Math.toDegrees(carto.longitude).toFixed(6)}°, `
    + `lat ${Cesium.Math.toDegrees(carto.latitude).toFixed(6)}°, alt ${carto.height.toFixed(1)}m`,
  )
}

// Shift+Click 手动放置
const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas)
clickHandler.setInputAction(
  (movement: { position: Cesium.Cartesian2 }) => {
    const pos = viewer.scene.pickPosition(movement.position)
    if (Cesium.defined(pos)) {
      ;(targetPoint.position as Cesium.ConstantPositionProperty).setValue(pos as Cesium.Cartesian3)
      targetPoint.show = true
      const carto = Cesium.Cartographic.fromCartesian(pos as Cesium.Cartesian3)
      console.log(
        `[point] 标记点: lon ${Cesium.Math.toDegrees(carto.longitude).toFixed(6)}°, `
        + `lat ${Cesium.Math.toDegrees(carto.latitude).toFixed(6)}°, alt ${carto.height.toFixed(1)}m`,
      )
    }
  },
  Cesium.ScreenSpaceEventType.LEFT_CLICK,
  Cesium.KeyboardEventModifier.SHIFT,
)

/**
 * 将节点移动到标记点位置。
 *
 * 数学推导：
 *   worldMat = A × ourTransform     其中 A = modelToWorld × parentChain × originalMatrix
 *   T_w = R_A × t_our + T_A
 *   R_w = R_A × R_our
 *
 *   ΔT_w = R_A × Δt_our = R_w × R_ourᵀ × Δt_our
 *   ⇒ Δt_our = R_our × inv(R_w) × ΔT_w
 *
 *   其中 ΔT_w = P_target − P_current（世界空间）
 */
function moveNodeToTarget(nodeGetter: () => Cesium.ModelNode | undefined): void {
  // 标记点未放置 → 自动放到模型前方 100m
  if (!targetPoint.show) {
    placeTargetNearModel()
  }

  const node = nodeGetter()
  if (!node) {
    console.warn('[move] 节点尚未就绪')
    return
  }

  const worldMat = getNodeWorldMatrix(node, new Cesium.Matrix4())
  const currentPos = Cesium.Matrix4.getTranslation(worldMat, new Cesium.Cartesian3())
  const targetPos = (targetPoint.position as Cesium.ConstantPositionProperty).getValue(
    new Cesium.JulianDate(),
  ) as Cesium.Cartesian3

  // 世界偏移
  const worldDelta = Cesium.Cartesian3.subtract(targetPos, currentPos, new Cesium.Cartesian3())

  // R_w（含 scale），R_our（从 node.matrix 剥离）
  const R_w = Cesium.Matrix4.getMatrix3(worldMat, new Cesium.Matrix3())
  const ourTransform = Cesium.Matrix4.multiply(
    Cesium.Matrix4.inverse(node.originalMatrix, new Cesium.Matrix4()),
    node.matrix,
    new Cesium.Matrix4(),
  )
  const R_our = Cesium.Matrix4.getMatrix3(ourTransform, new Cesium.Matrix3())

  // Δt_our = R_our × inv(R_w) × Δw
  const invR_w = Cesium.Matrix3.inverse(R_w, new Cesium.Matrix3())
  const temp = Cesium.Matrix3.multiplyByVector(invR_w, worldDelta, new Cesium.Cartesian3())
  const tDelta = Cesium.Matrix3.multiplyByVector(R_our, temp, new Cesium.Cartesian3())

  translation.x += tDelta.x
  translation.y += tDelta.y
  translation.z += tDelta.z

  logTransform('move-to-point')

  const dist = Cesium.Cartesian3.magnitude(worldDelta)
  console.log(
    `[move] 移动距离: ${dist.toFixed(2)}m (世界), `
    + `local=[${tDelta.x.toFixed(3)}, ${tDelta.y.toFixed(3)}, ${tDelta.z.toFixed(3)}]`,
  )
}

// #endregion

// #region 模型加载与初始化

modelPromise.then((model) => {
  viewer.scene.primitives.add(model)
  currentModel = model

  model.readyEvent.addEventListener(() => {
    propL = model.getNode('Prop')
    propR = model.getNode('Prop__2_')

    // 为左右螺旋桨各创建坐标轴
    allAxes.push(createNodeAxes(viewer.scene, () => propL))
    allAxes.push(createNodeAxes(viewer.scene, () => propR))

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

// ── 辅助 DOM 工厂 ───────────────────────────────

const toolbar = document.getElementById('toolbar')!

function createSection(title: string): HTMLElement {
  const section = document.createElement('div')
  section.className = 'tool-section'

  const header = document.createElement('div')
  header.className = 'tool-section-title'
  header.textContent = title
  section.appendChild(header)

  return section
}

function createRow(): HTMLElement {
  const row = document.createElement('div')
  row.className = 'tool-row'
  return row
}

function createBtn(text: string, onclick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'stratakit-mimic-button'
  btn.textContent = text
  btn.onclick = onclick
  return btn
}

function createSelect(
  options: { text: string, onselect: () => void }[],
  defaultIndex = 0,
): HTMLSelectElement {
  const select = document.createElement('select')
  select.className = 'stratakit-mimic-button stratakit-mimic-select'
  for (const opt of options) {
    const el = document.createElement('option')
    el.textContent = opt.text
    select.appendChild(el)
  }
  select.selectedIndex = defaultIndex
  select.onchange = () => {
    const idx = select.selectedIndex
    if (idx >= 0 && options[idx])
      options[idx].onselect()
  }
  return select
}

function createToggle(
  text: string,
  checked: boolean,
  onchange: (c: boolean) => void,
): HTMLElement {
  const field = document.createElement('div')
  field.className = 'stratakit-mimic-field'

  const id = `toggle-${Math.random().toString(36).slice(2)}`
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.className = 'stratakit-mimic-switch'
  checkbox.id = id
  checkbox.checked = checked
  checkbox.onchange = () => onchange(checkbox.checked)

  const label = document.createElement('label')
  label.className = 'stratakit-mimic-label'
  label.htmlFor = id
  label.textContent = text

  field.appendChild(checkbox)
  field.appendChild(label)
  return field
}

// ── 显示控制 ──────────────────────────────────

const displaySection = createSection('显示控制')
const displayRow = createRow()

displayRow.appendChild(
  createToggle('显示包围盒', false, (checked) => {
    modelPromise.then((model) => { model.debugShowBoundingVolume = checked })
  }),
)
displayRow.appendChild(
  createToggle('显示节点坐标轴', true, (checked) => {
    showAxes = checked
    for (const data of allAxes) {
      data.lines.show = checked
      data.labels.show = checked
    }
  }),
)

displaySection.appendChild(displayRow)
toolbar.appendChild(displaySection)

// ── 旋转控制 ──────────────────────────────────

const rotationSection = createSection('旋转控制')

// 第 1 行：速度 + 方向 + 重置
const rotRow1 = createRow()
rotRow1.appendChild(createSelect([
  { text: '⏹ 停止', onselect: () => { propAngularVelocity = 0 } },
  { text: '🐢 慢速 100 RPM', onselect: () => { propAngularVelocity = Cesium.Math.toRadians(100 * 6) } },
  { text: '✈ 巡航 800 RPM', onselect: () => { propAngularVelocity = Cesium.Math.toRadians(800 * 6) } },
  { text: '🚀 高速 2000 RPM', onselect: () => { propAngularVelocity = Cesium.Math.toRadians(2000 * 6) } },
], 1))
rotRow1.appendChild(createSelect([
  { text: '↻ 正转', onselect: () => { propDirection = 1 } },
  { text: '↺ 反转', onselect: () => { propDirection = -1 } },
]))
rotRow1.appendChild(createBtn('🔄 重置', () => {
  translation.x = 0; translation.y = 0; translation.z = 0
  extraRotation.heading = 0; extraRotation.pitch = 0; extraRotation.roll = 0
  propAngle = 0
  targetPoint.show = false
  logTransform('reset')
}))
rotationSection.appendChild(rotRow1)

// 第 2 行：操作提示
const rotRow2 = createRow()
const hint = document.createElement('span')
hint.className = 'tool-hint'
hint.textContent = 'W/S/A/D/Q/E 平移 | ←→↑↓ 旋转 | ,/. 滚转 | R 重置 | Shift 加速 | Shift+Click 设标记点'
rotRow2.appendChild(hint)
rotationSection.appendChild(rotRow2)

toolbar.appendChild(rotationSection)

// ── 移动目标点设置 ─────────────────────────────

const targetSection = createSection('移动目标点设置')

// 第 1 行：坐标输入 + 设置按钮
const targetRow1 = createRow()

const lonInput = document.createElement('input')
lonInput.type = 'number'
lonInput.className = 'tool-input'
lonInput.placeholder = '经度'
lonInput.value = String(LON)
lonInput.step = '0.0001'
targetRow1.appendChild(lonInput)

const latInput = document.createElement('input')
latInput.type = 'number'
latInput.className = 'tool-input'
latInput.placeholder = '纬度'
latInput.value = String(LAT)
latInput.step = '0.0001'
targetRow1.appendChild(latInput)

const altInput = document.createElement('input')
altInput.type = 'number'
altInput.className = 'tool-input'
altInput.placeholder = '高度(m)'
altInput.value = String(ALT + 100)
altInput.step = '1'
targetRow1.appendChild(altInput)

targetRow1.appendChild(createBtn('设置坐标', () => {
  const lon = Number.parseFloat(lonInput.value)
  const lat = Number.parseFloat(latInput.value)
  const alt = Number.parseFloat(altInput.value)
  if (Number.isNaN(lon) || Number.isNaN(lat) || Number.isNaN(alt)) {
    console.warn('[point] 请输入有效的经纬度和高度')
    return
  }
  const pos = Cesium.Cartesian3.fromDegrees(lon, lat, alt)
  ;(targetPoint.position as Cesium.ConstantPositionProperty).setValue(pos)
  targetPoint.show = true
  viewer.canvas.focus()
  console.log(
    `[point] 标记点(手动): lon ${lon.toFixed(6)}°, `
    + `lat ${lat.toFixed(6)}°, alt ${alt.toFixed(1)}m`,
  )
}))

targetSection.appendChild(targetRow1)

// 第 2 行：移动按钮
const targetRow2 = createRow()
targetRow2.appendChild(createBtn('📍 左桨 → 标记点', () => { moveNodeToTarget(() => propL!); viewer.canvas.focus() }))
targetRow2.appendChild(createBtn('📍 右桨 → 标记点', () => { moveNodeToTarget(() => propR!); viewer.canvas.focus() }))
targetSection.appendChild(targetRow2)

toolbar.appendChild(targetSection)

// #endregion

// #region 视角

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
