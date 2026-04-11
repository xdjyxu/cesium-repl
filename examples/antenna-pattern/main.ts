import * as Cesium from 'cesium'
import Sandcastle from 'Sandcastle'

import dir2900 from './dir-2900.js'
import dir3100 from './dir-3100.js'
import dir3400 from './dir-3400.js'
import omni2900 from './omni-2900.js'
import omni3050 from './omni-3050.js'
import omni3200 from './omni-3200.js'

// #region 天线类型枚举

/** 天线方向图类型，决定 CSV 数据的解析方式 */
enum AntennaType {
  /** 全向天线：col2 = 仰角截面（Phi 固定），绕 Z 轴旋转生成 3D */
  Omni = 'omni',
  /** 定向天线：col2 = Phi=0° 截面，col3 = Phi=90° 截面，加权插值生成 3D */
  Directional = 'directional',
}

// #endregion

// #region 数据解析

interface CsvRow { theta: number, col2: number | null, col3: number | null }

function parseCSV(text: string): CsvRow[] {
  return text.trim().split('\n').slice(1).map((line) => {
    const parts = line.split(',')
    return {
      theta: Number.parseFloat(parts[0]),
      col2: parts[1]?.trim() ? Number.parseFloat(parts[1]) : null,
      col3: parts[2]?.trim() ? Number.parseFloat(parts[2]) : null,
    }
  })
}

function dBToLinear(dB: number): number {
  return 10 ** (dB / 10)
}

// #endregion

// #region 网格生成（本地坐标系，不含 ENU 变换）

interface GridCell { x: number, y: number, z: number, norm: number }
type Grid = GridCell[][]

/** 顶点坐标输出为天线本地 ENU 坐标（原点=天线位置，无姿态旋转），由 modelMatrix 在 GPU 侧完成变换 */
function buildGrid(rows: CsvRow[], type: AntennaType, maxRange: number): Grid {
  const PHI_STEPS = 73

  if (type === AntennaType.Omni) {
    const elevData = rows
      .filter(r => r.col2 !== null && r.theta >= 0 && r.theta <= 180)
      .sort((a, b) => a.theta - b.theta)
    const maxLinear = Math.max(...elevData.map(r => dBToLinear(r.col2!)))

    return elevData.map(({ theta, col2 }) => {
      const norm = dBToLinear(col2!) / maxLinear
      const r = norm * maxRange
      const tRad = Cesium.Math.toRadians(theta)
      const sinT = Math.sin(tRad)
      const cosT = Math.cos(tRad)
      return Array.from({ length: PHI_STEPS }, (_, i) => {
        const pRad = Cesium.Math.toRadians((i / (PHI_STEPS - 1)) * 360)
        return { x: r * sinT * Math.cos(pRad), y: r * sinT * Math.sin(pRad), z: -r * cosT, norm }
      })
    })
  }
  else {
    const phi0 = new Map<number, number>()
    const phi90 = new Map<number, number>()
    for (const { theta, col2, col3 } of rows) {
      if (theta < -180 || theta > 180)
        continue
      if (col2 !== null)
        phi0.set(theta, col2)
      if (col3 !== null)
        phi90.set(theta, col3)
    }
    const maxLinear = Math.max(
      ...Array.from(phi0.values()).map(dBToLinear),
      ...Array.from(phi90.values()).map(dBToLinear),
    )
    const thetaValues = Array.from(phi0.keys()).sort((a, b) => a - b)

    return thetaValues.map((theta) => {
      const g0 = dBToLinear(phi0.get(theta)!) / maxLinear
      const g90 = dBToLinear(phi90.get(theta) ?? phi0.get(theta)!) / maxLinear
      const tRad = Cesium.Math.toRadians(theta)
      const sinT = Math.sin(tRad)
      const cosT = Math.cos(tRad)
      return Array.from({ length: PHI_STEPS }, (_, i) => {
        const pRad = Cesium.Math.toRadians(-180 + (i / (PHI_STEPS - 1)) * 360)
        const norm = g0 * Math.cos(pRad) ** 2 + g90 * Math.sin(pRad) ** 2
        const r = norm * maxRange
        return { x: r * sinT * Math.cos(pRad), y: r * sinT * Math.sin(pRad), z: r * cosT, norm }
      })
    })
  }
}

// #endregion

// #region 颜色映射

function gainToColor(t: number): [number, number, number, number] {
  let r: number, g: number, b: number
  if (t < 0.25) {
    r = 0
    g = t * 4
    b = 1
  }
  else if (t < 0.5) {
    r = 0
    g = 1
    b = 1 - (t - 0.25) * 4
  }
  else if (t < 0.75) {
    r = (t - 0.5) * 4
    g = 1
    b = 0
  }
  else {
    r = 1
    g = 1 - (t - 0.75) * 4
    b = 0
  }
  return [r, g, b, 0.75]
}

// #endregion

// #region Primitive 构建

const MESH_VERTEX_SHADER = `
  in vec3 position3DHigh;
  in vec3 position3DLow;
  in float batchId;
  in vec4 color;
  out vec4 v_color;
  void main() {
    vec4 p = czm_computePosition();
    v_color = color;
    gl_Position = czm_modelViewProjectionRelativeToEye * p;
  }
`
const MESH_FRAGMENT_SHADER = `
  in vec4 v_color;
  void main() {
    out_FragColor = v_color;
  }
`

function buildMeshPrimitive(grid: Grid): Cesium.Primitive {
  const tLen = grid.length
  const pLen = grid[0].length
  const positions: number[] = []
  const colors: number[] = []

  for (let ti = 0; ti < tLen - 1; ti++) {
    for (let pi = 0; pi < pLen - 1; pi++) {
      const p00 = grid[ti][pi]
      const p10 = grid[ti + 1][pi]
      const p11 = grid[ti + 1][pi + 1]
      const p01 = grid[ti][pi + 1]
      for (const tri of [[p00, p10, p11], [p00, p11, p01]]) {
        for (const { x, y, z, norm } of tri) {
          positions.push(x, y, z)
          const [r, g, b, a] = gainToColor(norm)
          colors.push(r, g, b, a)
        }
      }
    }
  }

  const geometry = new Cesium.Geometry({
    attributes: {
      position: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: new Float64Array(positions),
      }),
      color: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.FLOAT,
        componentsPerAttribute: 4,
        values: new Float32Array(colors),
      }),
    } as Cesium.GeometryAttributes,
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
  })

  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({ geometry }),
    appearance: new Cesium.Appearance({
      translucent: true,
      renderState: {
        depthTest: { enabled: true },
        blending: Cesium.BlendingState.ALPHA_BLEND,
        cull: { enabled: false },
      },
      vertexShaderSource: MESH_VERTEX_SHADER,
      fragmentShaderSource: MESH_FRAGMENT_SHADER,
    }),
    asynchronous: false,
  })
}

/**
 * 原始测量数据散点：Omni 显示仰角截面（phi=0 平面），Directional 显示两个测量截面（phi=0 和 phi=90°）
 * position 为天线本地 ENU 坐标，由 collection.modelMatrix 变换到世界坐标（与 Primitive 一致）
 */
function buildPointsPrimitive(rows: CsvRow[], type: AntennaType, maxRange: number): Cesium.PointPrimitiveCollection {
  const collection = new Cesium.PointPrimitiveCollection({
    blendOption: Cesium.BlendOption.OPAQUE,
  })

  if (type === AntennaType.Omni) {
    const elevData = rows
      .filter(r => r.col2 !== null && r.theta >= 0 && r.theta <= 180)
      .sort((a, b) => a.theta - b.theta)
    const maxLinear = Math.max(...elevData.map(r => dBToLinear(r.col2!)))
    for (const { theta, col2 } of elevData) {
      const norm = dBToLinear(col2!) / maxLinear
      const r = norm * maxRange
      const tRad = Cesium.Math.toRadians(theta)
      const [cr, cg, cb] = gainToColor(norm)
      collection.add({
        position: new Cesium.Cartesian3(r * Math.sin(tRad), 0, -r * Math.cos(tRad)),
        color: new Cesium.Color(cr, cg, cb, 1.0),
        pixelSize: 5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      })
    }
  }
  else {
    const phi0 = new Map<number, number>()
    const phi90 = new Map<number, number>()
    for (const { theta, col2, col3 } of rows) {
      if (theta < -180 || theta > 180)
        continue
      if (col2 !== null)
        phi0.set(theta, col2)
      if (col3 !== null)
        phi90.set(theta, col3)
    }
    const maxLinear = Math.max(
      ...Array.from(phi0.values()).map(dBToLinear),
      ...Array.from(phi90.values()).map(dBToLinear),
    )
    for (const [theta, db] of phi0) {
      const norm = dBToLinear(db) / maxLinear
      const r = norm * maxRange
      const tRad = Cesium.Math.toRadians(theta)
      const [cr, cg, cb] = gainToColor(norm)
      collection.add({
        position: new Cesium.Cartesian3(r * Math.sin(tRad), 0, r * Math.cos(tRad)),
        color: new Cesium.Color(cr, cg, cb, 1.0),
        pixelSize: 5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      })
    }
    for (const [theta, db] of phi90) {
      const norm = dBToLinear(db) / maxLinear
      const r = norm * maxRange
      const tRad = Cesium.Math.toRadians(theta)
      const [cr, cg, cb] = gainToColor(norm)
      collection.add({
        position: new Cesium.Cartesian3(0, r * Math.sin(tRad), r * Math.cos(tRad)),
        color: new Cesium.Color(cr, cg, cb, 1.0),
        pixelSize: 5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      })
    }
  }

  return collection
}

function buildWireframePrimitive(grid: Grid): Cesium.Primitive {
  const tLen = grid.length
  const pLen = grid[0].length
  const instances: Cesium.GeometryInstance[] = []
  const toC3 = (cell: GridCell) => new Cesium.Cartesian3(cell.x, cell.y, cell.z)
  const white = (n: number) => Array.from({ length: n }, () => new Cesium.Color(1, 1, 1, 0.6))

  const phiStride = Math.max(1, Math.floor((pLen - 1) / 16))
  for (let pi = 0; pi < pLen; pi += phiStride) {
    const positions = grid.map(row => toC3(row[pi]))
    instances.push(new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions,
        width: 1,
        arcType: Cesium.ArcType.NONE,
        vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
        colors: white(positions.length),
      }),
    }))
  }

  const thetaStride = Math.max(1, Math.floor((tLen - 1) / 18))
  for (let ti = 0; ti < tLen; ti += thetaStride) {
    const positions = grid[ti].map(toC3)
    instances.push(new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions,
        width: 1,
        arcType: Cesium.ArcType.NONE,
        vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
        colors: white(positions.length),
      }),
    }))
  }

  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
    asynchronous: false,
  })
}

// #endregion

// #region AntennaPatternPrimitive

interface AntennaPatternOptions {
  position: Cesium.Cartesian3
  maxRange?: number
  showMesh?: boolean
  showWireframe?: boolean
  showPoints?: boolean
}

class AntennaPatternPrimitive {
  readonly position: Cesium.Cartesian3
  private _maxRange: number

  get maxRange(): number { return this._maxRange }
  set maxRange(v: number) {
    if (v === this._maxRange)
      return
    this._maxRange = v
    this._dataDirty = true
  }

  private _baseEnu: Cesium.Matrix4
  private _modelMatrix: Cesium.Matrix4
  private _rows: CsvRow[] = []
  private _type: AntennaType = AntennaType.Omni
  private _dataDirty = false
  private _mesh: Cesium.Primitive | null = null
  private _wireframe: Cesium.Primitive | null = null
  private _points: Cesium.PointPrimitiveCollection | null = null
  private _destroyed = false
  private _showMesh: boolean
  private _showWireframe: boolean
  private _showPoints: boolean

  constructor(options: AntennaPatternOptions) {
    this.position = options.position
    this._maxRange = options.maxRange ?? 30000
    this._showMesh = options.showMesh ?? true
    this._showWireframe = options.showWireframe ?? false
    this._showPoints = options.showPoints ?? false
    this._baseEnu = Cesium.Transforms.eastNorthUpToFixedFrame(this.position)
    this._modelMatrix = this._baseEnu.clone()
  }

  get showMesh(): boolean { return this._showMesh }
  set showMesh(v: boolean) {
    this._showMesh = v
    if (this._mesh)
      this._mesh.show = v
  }

  get showWireframe(): boolean { return this._showWireframe }
  set showWireframe(v: boolean) {
    this._showWireframe = v
    if (this._wireframe)
      this._wireframe.show = v
  }

  get showPoints(): boolean { return this._showPoints }
  set showPoints(v: boolean) {
    this._showPoints = v
    if (this._points)
      this._points.show = v
  }

  /** 位置与姿态变换矩阵，与 Cesium Primitive.modelMatrix 语义一致 */
  get modelMatrix(): Cesium.Matrix4 { return this._modelMatrix }
  set modelMatrix(v: Cesium.Matrix4) {
    if (Cesium.Matrix4.equals(v, this._modelMatrix))
      return
    Cesium.Matrix4.clone(v, this._modelMatrix)
    if (this._mesh)
      Cesium.Matrix4.clone(this._modelMatrix, this._mesh.modelMatrix)
    if (this._wireframe)
      Cesium.Matrix4.clone(this._modelMatrix, this._wireframe.modelMatrix)
    if (this._points)
      Cesium.Matrix4.clone(this._modelMatrix, this._points.modelMatrix)
  }

  async loadCSV(urlOrText: string, type: AntennaType): Promise<void> {
    const isUrl = /^https?:\/\/|^\//.test(urlOrText)
    const text = isUrl ? await (await fetch(urlOrText)).text() : urlOrText
    this.setData(parseCSV(text), type)
  }

  setData(rows: CsvRow[], type: AntennaType): void {
    this._rows = rows
    this._type = type
    this._dataDirty = true
  }

  private _rebuild(): void {
    if (this._destroyed || this._rows.length === 0)
      return
    const grid = buildGrid(this._rows, this._type, this.maxRange)
    this._mesh?.destroy()
    this._wireframe?.destroy()
    this._points?.destroy()
    this._mesh = buildMeshPrimitive(grid)
    this._mesh.show = this._showMesh
    Cesium.Matrix4.clone(this._modelMatrix, this._mesh.modelMatrix)
    this._wireframe = buildWireframePrimitive(grid)
    this._wireframe.show = this._showWireframe
    Cesium.Matrix4.clone(this._modelMatrix, this._wireframe.modelMatrix)
    this._points = buildPointsPrimitive(this._rows, this._type, this.maxRange)
    this._points.show = this._showPoints
    Cesium.Matrix4.clone(this._modelMatrix, this._points.modelMatrix)
    this._dataDirty = false
  }

  update(frameState: { commandList: unknown[] }): void {
    if (this._destroyed)
      return
    if (this._dataDirty)
      this._rebuild()
    // @ts-expect-error Cesium type definitions omit the frameState parameter, but it is required at runtime
    this._mesh?.update(frameState)
    // @ts-expect-error Cesium type definitions omit the frameState parameter, but it is required at runtime
    this._wireframe?.update(frameState)
    // @ts-expect-error Cesium type definitions omit the frameState parameter, but it is required at runtime
    this._points?.update(frameState)
  }

  isDestroyed(): boolean { return this._destroyed }

  destroy(): void {
    if (this._destroyed)
      return
    this._mesh?.destroy()
    this._wireframe?.destroy()
    this._points?.destroy()
    this._mesh = null
    this._wireframe = null
    this._points = null
    this._destroyed = true
  }
}

// #endregion

// #region 动态姿态

type MotionMode = 'static' | 'tilt-spin' | 'figure8'

/** static / tilt-spin 模式下根据时间 t 计算 modelMatrix（原地，不移动位置） */
function computeStaticTransform(baseEnu: Cesium.Matrix4, mode: MotionMode, t: number): Cesium.Matrix4 {
  if (mode !== 'tilt-spin')
    return baseEnu
  const qTilt = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, Cesium.Math.toRadians(30), new Cesium.Quaternion())
  const qSpin = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, (t / 20) * Cesium.Math.TWO_PI, new Cesium.Quaternion())
  const q = Cesium.Quaternion.multiply(qSpin, qTilt, new Cesium.Quaternion())
  const rotMat4 = Cesium.Matrix4.fromRotationTranslation(
    Cesium.Matrix3.fromQuaternion(q, new Cesium.Matrix3()),
    Cesium.Cartesian3.ZERO,
    new Cesium.Matrix4(),
  )
  return Cesium.Matrix4.multiply(baseEnu, rotMat4, new Cesium.Matrix4())
}

// 8字飞行参数：Lissajous x=R·sin(2φ), y=R·sin(φ)，高度随 cos(2φ) 起伏
const FIGURE8_PERIOD = 40 // 秒/圈
const FIGURE8_RADIUS = 20000 // 水平半径（米）
const FIGURE8_HEIGHT = 3000 // 高度振幅（米）

/** 根据相位 φ 计算 ENU 局部坐标（高度始终为正，范围 [0, 2·FIGURE8_HEIGHT]） */
function figure8Enu(phi: number): Cesium.Cartesian3 {
  return new Cesium.Cartesian3(
    FIGURE8_RADIUS * Math.sin(2 * phi),
    FIGURE8_RADIUS * Math.sin(phi),
    FIGURE8_HEIGHT * (1 - Math.cos(2 * phi)), // [0, 2H]，最低点与天线同高
  )
}

/** 构建 figure8 的 SampledPositionProperty，采样密度 1Hz */
function buildFigure8Position(origin: Cesium.Cartesian3, start: Cesium.JulianDate): Cesium.SampledPositionProperty {
  const enuRot = new Cesium.Matrix3()
  Cesium.Matrix4.getMatrix3(Cesium.Transforms.eastNorthUpToFixedFrame(origin), enuRot)

  const prop = new Cesium.SampledPositionProperty()
  prop.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD
  prop.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD

  const SAMPLES = FIGURE8_PERIOD // 1Hz 采样
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * FIGURE8_PERIOD
    const phi = (t / FIGURE8_PERIOD) * Cesium.Math.TWO_PI
    const enuOffset = figure8Enu(phi)
    const ecefOffset = Cesium.Matrix3.multiplyByVector(enuRot, enuOffset, new Cesium.Cartesian3())
    const pos = Cesium.Cartesian3.add(origin, ecefOffset, new Cesium.Cartesian3())
    prop.addSample(Cesium.JulianDate.addSeconds(start, t, new Cesium.JulianDate()), pos)
  }
  return prop
}

// #endregion

// #region Demo

// 西安坐标（钟楼附近）
const LON = 108.9402
const LAT = 34.2658
const ALT = 500

const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
})

viewer.scene.debugShowFramesPerSecond = true

// 循环时间轴：一个 figure8 周期
const start = Cesium.JulianDate.now()
const stop = Cesium.JulianDate.addSeconds(start, FIGURE8_PERIOD, new Cesium.JulianDate())
viewer.clock.startTime = start.clone()
viewer.clock.stopTime = stop.clone()
viewer.clock.currentTime = start.clone()
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
viewer.clock.multiplier = 1
viewer.timeline?.zoomTo(start, stop)

const antennaPosition = Cesium.Cartesian3.fromDegrees(LON, LAT, ALT)
const baseEnu = Cesium.Transforms.eastNorthUpToFixedFrame(antennaPosition)
const figure8Position = buildFigure8Position(antennaPosition, start)
const staticPosition = new Cesium.ConstantPositionProperty(antennaPosition)
const velocityOrientation = new Cesium.VelocityOrientationProperty(figure8Position)

let motionMode: MotionMode = 'static'

const antennaEntity = viewer.entities.add({
  position: staticPosition,
  orientation: velocityOrientation,
  point: { pixelSize: 10, color: Cesium.Color.YELLOW },
  label: {
    text: '天线',
    font: '14px sans-serif',
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cesium.Cartesian2(0, -20),
  },
  path: {
    show: new Cesium.CallbackProperty(() => motionMode === 'figure8', false),
    width: 2,
    material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.YELLOW }),
    leadTime: 0,
    trailTime: FIGURE8_PERIOD,
  },
})

const antennaPrimitive = new AntennaPatternPrimitive({ position: antennaPosition, maxRange: 30000 })
viewer.scene.primitives.add(antennaPrimitive)

viewer.scene.preUpdate.addEventListener(() => {
  const time = viewer.clock.currentTime
  const t = Cesium.JulianDate.secondsDifference(time, start)

  if (motionMode === 'figure8') {
    const pos = figure8Position.getValue(time)
    const ori = velocityOrientation.getValue(time)
    if (pos && ori) {
      antennaPrimitive.modelMatrix = Cesium.Matrix4.fromRotationTranslation(
        Cesium.Matrix3.fromQuaternion(ori as Cesium.Quaternion, new Cesium.Matrix3()),
        pos,
        new Cesium.Matrix4(),
      )
    }
  }
  else {
    antennaPrimitive.modelMatrix = computeStaticTransform(baseEnu, motionMode, t)
  }
})

// #endregion

// #region 工具栏

const ANTENNA_DATA: Record<string, { type: AntennaType, csvs: string[] }> = {
  全向: { type: AntennaType.Omni, csvs: [omni2900, omni3050, omni3200] },
  定向: { type: AntennaType.Directional, csvs: [dir2900, dir3100, dir3400] },
}

let currentKey = '全向'

function reload(key: string, freqIndex: number) {
  currentKey = key
  const { type, csvs } = ANTENNA_DATA[key]
  antennaPrimitive.loadCSV(csvs[freqIndex], type)
}

Sandcastle.addToolbarMenu(
  Object.keys(ANTENNA_DATA).map(key => ({
    text: key,
    onselect: () => reload(key, 0),
  })),
)

Sandcastle.addToolbarMenu([
  { text: '频率 1', onselect: () => reload(currentKey, 0) },
  { text: '频率 2', onselect: () => reload(currentKey, 1) },
  { text: '频率 3', onselect: () => reload(currentKey, 2) },
])

Sandcastle.addToolbarMenu([
  {
    text: '静止',
    onselect: () => {
      motionMode = 'static'
      antennaEntity.position = staticPosition
    },
  },
  {
    text: '倾斜转圈',
    onselect: () => {
      motionMode = 'tilt-spin'
      antennaEntity.position = staticPosition
    },
  },
  {
    text: '8字形绕圈',
    onselect: () => {
      motionMode = 'figure8'
      antennaEntity.position = figure8Position
    },
  },
])

Sandcastle.addToolbarMenu([
  { text: '范围 30km', onselect: () => { antennaPrimitive.maxRange = 30000 } },
  { text: '范围 5km', onselect: () => { antennaPrimitive.maxRange = 5000 } },
  { text: '范围 10km', onselect: () => { antennaPrimitive.maxRange = 10000 } },
  { text: '范围 100km', onselect: () => { antennaPrimitive.maxRange = 100000 } },
])

Sandcastle.addToggleButton('轮廓线', false, (checked: boolean) => {
  antennaPrimitive.showWireframe = checked
})

Sandcastle.addToggleButton('面片', true, (checked: boolean) => {
  antennaPrimitive.showMesh = checked
})

Sandcastle.addToggleButton('散点', false, (checked: boolean) => {
  antennaPrimitive.showPoints = checked
})

reload('全向', 0)

// 垂直俯视天线，高度约为 maxRange 的 2.5 倍确保方向图完整入画
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(LON, LAT, 75000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
})

// #endregion
