import type { CompileService, CompileState, RollupOptions, RollupOutput } from './protocol'
import { rollup } from '@rollup/browser'
import { BehaviorSubject } from 'rxjs'
import { CompileStatus } from './protocol'

export { swcWasm } from './swc-wasm-plugin'

export class CompileServiceImpl implements CompileService {
  private readonly stateSubject: BehaviorSubject<CompileState>
  private isLocked = false

  constructor() {
    this.stateSubject = new BehaviorSubject<CompileState>({
      status: CompileStatus.Idle,
      isCompiling: false,
    })
  }

  get state$() {
    return this.stateSubject.asObservable()
  }

  async compile(options: RollupOptions): Promise<RollupOutput[]> {
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
