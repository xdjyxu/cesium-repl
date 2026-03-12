import type { Plugin } from '@rollup/browser'

export interface CssInlinePlugin extends Plugin {
  /** Returns all CSS collected from JS/TS import statements */
  getCollectedCss: () => string
}

/**
 * Rollup plugin that intercepts CSS file imports in JS/TS modules.
 *
 * - Reads each imported `.css` file via `loadFile` and accumulates the content
 * - Returns an empty ES module so Rollup does not attempt to parse raw CSS
 * - Collected CSS can be retrieved after bundling via `getCollectedCss()`
 *
 * @param loadFile - Async function that reads a file by absolute path
 */
export function cssInline(
  loadFile: (id: string) => Promise<string | null>,
): CssInlinePlugin {
  const chunks: string[] = []

  return {
    name: 'css-inline',

    async load(id) {
      if (!/\.css$/i.test(id))
        return null

      try {
        const css = await loadFile(id)
        if (css != null && css.length > 0)
          chunks.push(css)
      }
      catch {
        // file not found — silently skip
      }

      // Return an empty module so Rollup treats the import as a no-op
      return { code: 'export default ""', map: null }
    },

    getCollectedCss() {
      return chunks.join('\n')
    },
  }
}
