import type { CompileService, CompileState, RollupOptions, RollupOutput } from '../common/protocol'
import { rollup } from '@rollup/browser'
import initSwc from '@swc/wasm-web'
import { BehaviorSubject } from 'rxjs'
import { Deferred } from '~/utils/deferred'
import { CompileStatus } from '../common/protocol'

export class CompileServiceImpl implements CompileService {
  private readonly stateSubject: BehaviorSubject<CompileState>
  private isLocked = false
  private swcReady = new Deferred<void>()

  constructor() {
    this.stateSubject = new BehaviorSubject<CompileState>({
      status: CompileStatus.Idle,
      isCompiling: false,
    })

    // 初始化 SWC WASM
    this.initSwc()
  }

  private async initSwc() {
    try {
      await initSwc()
      this.swcReady.resolve()
    }
    catch (error) {
      this.swcReady.reject(error instanceof Error ? error : new Error(String(error)))
      console.error('Failed to initialize SWC WASM:', error)
    }
  }

  get state$() {
    return this.stateSubject.asObservable()
  }

  async compile(options: RollupOptions): Promise<RollupOutput[]> {
    // 等待 SWC 初始化完成
    await this.swcReady.promise

    // 如果正在编译，直接拒绝新请求
    if (this.isLocked) {
      const error = new Error('Compilation is already in progress')
      throw error
    }

    // 获取锁
    this.isLocked = true

    // 更新状态为编译中
    this.stateSubject.next({
      status: CompileStatus.Compiling,
      isCompiling: true,
      timestamp: new Date(),
    })

    try {
      const bundle = await rollup(options)
      const outputOptionsCollection = options.output
        ? Array.isArray(options.output)
          ? options.output
          : [options.output]
        : []

      const result = await Promise.all(
        outputOptionsCollection.map(outputOptions => bundle.generate(outputOptions)),
      )

      // 编译成功
      this.stateSubject.next({
        status: CompileStatus.Success,
        isCompiling: false,
        timestamp: new Date(),
      })

      return result
    }
    catch (error) {
      // 编译失败
      this.stateSubject.next({
        status: CompileStatus.Error,
        isCompiling: false,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      })

      throw error
    }
    finally {
      // 释放锁
      this.isLocked = false
    }
  }
}
