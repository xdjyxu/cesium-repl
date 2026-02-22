import { basename, dirname } from 'node:path'
import { defineTransformer } from '@nuxt/content'

export default defineTransformer({
  name: 'example-folder',
  extensions: ['.yaml', '.yml'],
  transform(file) {
    if (!file.id.endsWith('sandcastle.yaml')) {
      return file
    }
    return {
      ...file,
      slug: basename(dirname(file.id)),
    }
  },
})
