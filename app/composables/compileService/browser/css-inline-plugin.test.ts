import { describe, expect, it } from 'vitest'
import { cssInline } from './css-inline-plugin'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLoader(files: Record<string, string>) {
  return async (id: string): Promise<string | null> => files[id] ?? null
}

// Expose the private inlineCssLinks logic through a thin re-implementation so
// we can test it without touching the module boundary.  The real function lives
// inside useAutoCompile.ts and is not exported, so we duplicate the minimal
// logic here and keep the tests focused on the two public surfaces:
//   1. cssInline plugin  (css-inline-plugin.ts)
//   2. inlineCssLinks    (re-implemented below for isolation)

async function inlineCssLinks(
  html: string,
  loadFile: (path: string) => Promise<string>,
): Promise<string> {
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi
  const matches = [...html.matchAll(linkRe)]
  let result = html
  for (const match of matches) {
    const tag = match[0]
    const hrefMatch = tag.match(/href=["']([^"']+)["']/)
    if (!hrefMatch)
      continue
    const href = hrefMatch[1]
    if (!href)
      continue
    if (/^(?:https?:)?\/\//i.test(href))
      continue
    const absolutePath = href.startsWith('/') ? href : `/${href}`
    try {
      const css = await loadFile(absolutePath)
      result = result.replace(tag, `<style>\n${css}\n</style>`)
    }
    catch {
      // keep original tag
    }
  }
  return result
}

// Helper: call the plugin's load hook with a minimal context
type LoadHook = (this: object, id: string) => Promise<unknown>

async function pluginLoad(plugin: CssInlinePlugin, id: string) {
  return (plugin.load as LoadHook).call({}, id)
}

// ---------------------------------------------------------------------------
// cssInline plugin
// ---------------------------------------------------------------------------

describe('cssInline plugin', () => {
  it('collects css from a single import', async () => {
    const plugin = cssInline(makeLoader({ '/styles.css': 'body { color: red; }' }))
    await pluginLoad(plugin, '/styles.css')
    expect(plugin.getCollectedCss()).toBe('body { color: red; }')
  })

  it('collects css from multiple imports and joins with newline', async () => {
    const plugin = cssInline(makeLoader({
      '/a.css': '.a { color: red; }',
      '/b.css': '.b { color: blue; }',
    }))
    await pluginLoad(plugin, '/a.css')
    await pluginLoad(plugin, '/b.css')
    expect(plugin.getCollectedCss()).toBe('.a { color: red; }\n.b { color: blue; }')
  })

  it('returns empty string when no css was imported', () => {
    const plugin = cssInline(makeLoader({}))
    expect(plugin.getCollectedCss()).toBe('')
  })

  it('returns empty module code for css files', async () => {
    const plugin = cssInline(makeLoader({ '/styles.css': 'body {}' }))
    const result = await pluginLoad(plugin, '/styles.css')
    expect(result).toEqual({ code: 'export default ""', map: null })
  })

  it('returns null for non-css files', async () => {
    const plugin = cssInline(makeLoader({}))
    const result = await pluginLoad(plugin, '/main.ts')
    expect(result).toBeNull()
  })

  it('silently skips missing css files', async () => {
    const plugin = cssInline(makeLoader({}))
    await expect(pluginLoad(plugin, '/missing.css')).resolves.toEqual({ code: 'export default ""', map: null })
    expect(plugin.getCollectedCss()).toBe('')
  })

  it('skips empty css files', async () => {
    const plugin = cssInline(makeLoader({ '/empty.css': '' }))
    await pluginLoad(plugin, '/empty.css')
    expect(plugin.getCollectedCss()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// inlineCssLinks
// ---------------------------------------------------------------------------

describe('inlineCssLinks', () => {
  it('replaces a local link tag with inline style', async () => {
    const html = '<head><link rel="stylesheet" href="/styles.css"></head>'
    const loader = makeLoader({ '/styles.css': 'body { margin: 0; }' })
    const result = await inlineCssLinks(html, loader as (p: string) => Promise<string>)
    expect(result).toBe('<head><style>\nbody { margin: 0; }\n</style></head>')
  })

  it('handles href before rel attribute order', async () => {
    const html = '<head><link href="/a.css" rel="stylesheet"></head>'
    const loader = makeLoader({ '/a.css': '.a {}' })
    const result = await inlineCssLinks(html, loader as (p: string) => Promise<string>)
    expect(result).toBe('<head><style>\n.a {}\n</style></head>')
  })

  it('normalizes relative href to absolute path', async () => {
    const html = '<link rel="stylesheet" href="styles.css">'
    const loader = makeLoader({ '/styles.css': 'p {}' })
    const result = await inlineCssLinks(html, loader as (p: string) => Promise<string>)
    expect(result).toBe('<style>\np {}\n</style>')
  })

  it('leaves http remote links untouched', async () => {
    const html = '<link rel="stylesheet" href="https://cdn.example.com/style.css">'
    const loader = makeLoader({})
    const result = await inlineCssLinks(html, loader as (p: string) => Promise<string>)
    expect(result).toBe(html)
  })

  it('leaves protocol-relative remote links untouched', async () => {
    const html = '<link rel="stylesheet" href="//cdn.example.com/style.css">'
    const loader = makeLoader({})
    const result = await inlineCssLinks(html, loader as (p: string) => Promise<string>)
    expect(result).toBe(html)
  })

  it('keeps original tag when file is not found', async () => {
    const html = '<link rel="stylesheet" href="/missing.css">'
    const loader = async (_: string): Promise<string> => {
      throw new Error('not found')
    }
    const result = await inlineCssLinks(html, loader)
    expect(result).toBe(html)
  })

  it('replaces multiple link tags', async () => {
    const html = [
      '<link rel="stylesheet" href="/a.css">',
      '<link rel="stylesheet" href="/b.css">',
    ].join('\n')
    const loader = makeLoader({ '/a.css': '.a {}', '/b.css': '.b {}' })
    const result = await inlineCssLinks(html, loader as (p: string) => Promise<string>)
    expect(result).toBe('<style>\n.a {}\n</style>\n<style>\n.b {}\n</style>')
  })

  it('does not touch non-stylesheet link tags', async () => {
    const html = '<link rel="icon" href="/favicon.ico">'
    const loader = makeLoader({})
    const result = await inlineCssLinks(html, loader as (p: string) => Promise<string>)
    expect(result).toBe(html)
  })
})
