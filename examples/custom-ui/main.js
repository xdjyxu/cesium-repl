import * as Cesium from 'cesium'

const viewer = new Cesium.Viewer('cesiumContainer')

// Event handlers
document.getElementById('flyToSF').addEventListener('click', () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-122.4, 37.8, 4000.0),
  })
})

document.getElementById('flyToNY').addEventListener('click', () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-74.01, 40.7, 1000),
  })
})
