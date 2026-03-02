import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setHeader(event, 'Cache-Control', 'max-age=86400')

  const cesiumJsPath = resolve('node_modules/cesium/Source/Cesium.js')
  const cesiumJs = readFileSync(cesiumJsPath, 'utf-8')

  // Collect all exported names from:
  //   export { Name } from '...'
  //   export { Name as Alias } from '...'  → use original name (Alias)
  //   export const Name = ...
  const names = new Set<string>()

  for (const match of cesiumJs.matchAll(/^export\s+\{([^}]+)\}/gm)) {
    for (const part of match[1]!.split(',')) {
      // Handle "as Alias" — the alias is what gets exported
      const asMatch = part.trim().match(/\S+\s+as\s+(\S+)/)
      const name = asMatch ? asMatch[1] : part.trim().split(/\s+/)[0]
      if (name)
        names.add(name)
    }
  }

  for (const match of cesiumJs.matchAll(/^export\s+const\s+(\w+)/gm)) {
    if (match[1])
      names.add(match[1])
  }

  const lines = [
    'const _C = globalThis.Cesium;',
    'export default _C;',
    ...Array.from(names).map(name => `export const ${name} = _C.${name};`),
  ]

  return lines.join('\n')
})
