import * as Cesium from 'cesium'
import Sandcastle from 'Sandcastle'

const viewer = new Cesium.Viewer('cesiumContainer')

Sandcastle.addToggleButton('Show proposed design', true, (checked) => {
  console.warn(checked)
})
