import type { Plugin } from '@rollup/browser'
import type { Options as SWCOptions } from '@swc/wasm-web'
import type { SwcWasmPluginOptions } from '../common/protocol'
import { transformSync } from '@swc/wasm-web'
import { merge } from 'smob'

/**
 * Rollup plugin for transforming TypeScript/JavaScript using SWC in browser environment
 * @param input - Plugin options
 * @returns Rollup plugin instance
 */
export function swcWasm(input: SwcWasmPluginOptions = {}): Plugin {
  const filter = createFilter(
    input.include ?? [/\.[mc]?tsx?$/],
    input.exclude ?? [/node_modules/],
  )

  const defaults: SWCOptions = {
    jsc: {
      target: 'es2020',
      parser: {
        syntax: 'typescript',
        decorators: true,
        tsx: true,
      },
      transform: {
        decoratorMetadata: true,
        legacyDecorator: true,
      },
      loose: true,
    },
  }

  // If env is specified, remove default target to let SWC handle it
  if (input.swc && (input.swc as any).env) {
    delete defaults.jsc?.target
  }

  const swcOptions: SWCOptions = merge({}, input.swc || {}, defaults)

  return {
    name: 'swc-wasm',

    transform(code, id) {
      if (!filter(id))
        return null

      try {
        return transformSync(code, {
          ...swcOptions,
          sourceMaps: true,
          filename: id,
        })
      }
      catch (error) {
        this.error({
          message: `SWC transformation failed for ${id}`,
          cause: error instanceof Error ? error : new Error(String(error)),
        })
      }
    },
  }
}
