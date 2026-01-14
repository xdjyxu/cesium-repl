import type { OutputAsset, OutputChunk, RollupOptions, RollupOutput } from '@rollup/browser'
import type { Observable } from 'rxjs'

export type {
  OutputAsset,
  OutputChunk,
  RollupOptions,
  RollupOutput,
}

export enum CompileStatus {
  Idle = 'idle',
  Compiling = 'compiling',
  Success = 'success',
  Error = 'error',
}

export interface CompileState {
  status: CompileStatus
  isCompiling: boolean
  error?: Error
  timestamp?: Date
}

export interface CompileService {
  compile: (options: RollupOptions) => Promise<RollupOutput[]>
  readonly state$: Observable<CompileState>
}

// eslint-disable-next-line ts/no-redeclare
export const CompileService = Symbol('CompileService') as InjectionKey<CompileService>

// #region SWC Wasm Plugin Types

export interface SwcWasmPluginOptions {
  /**
   * SWC compilation options
   */
  swc?: any // Will be typed as Options from '@swc/wasm-web'

  /**
   * File patterns to include
   * @default [/\.[mc]?[jt]sx?$/]
   */
  include?: FilterPattern

  /**
   * File patterns to exclude
   * @default [/node_modules/]
   */
  exclude?: FilterPattern
}

export type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null

// #endregion
