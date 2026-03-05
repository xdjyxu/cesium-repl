import { basename, dirname } from 'node:path'
import { defineTransformer } from '@nuxt/content'

export default defineTransformer({
  name: 'example-folder',
  extensions: ['.yaml', '.yml'],
  transform(file) {
    if (!file.id.endsWith('sandcastle.yaml')) {
      return file
    }

    // Check if this is from the official Cesium repository
    const isOfficial = file.id.includes('packages/sandcastle/gallery')

    // Add "官方" label to official examples
    const labels = Array.isArray(file.labels) ? [...file.labels] : []
    if (isOfficial && !labels.includes('官方')) {
      labels.push('官方')
    }

    return {
      ...file,
      slug: basename(dirname(file.id)),
      labels,
    }
  },
})
