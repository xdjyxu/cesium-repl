/**
 * Deferred Promise 类
 * 允许外部控制 Promise 的 resolve 和 reject
 */
export class Deferred<T = void> {
  /**
   * Promise 实例
   */
  readonly promise: Promise<T>

  /**
   * Resolve 函数
   */
  private _resolve!: (value: T | PromiseLike<T>) => void

  /**
   * Reject 函数
   */
  private _reject!: (reason?: unknown) => void

  /**
   * 是否已完成（resolved 或 rejected）
   */
  private _settled = false

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
    })
  }

  /**
   * 解析 Promise
   */
  resolve(value: T | PromiseLike<T>): void {
    if (this._settled) {
      return
    }
    this._settled = true
    this._resolve(value)
  }

  /**
   * 拒绝 Promise
   */
  reject(reason?: unknown): void {
    if (this._settled) {
      return
    }
    this._settled = true
    this._reject(reason)
  }

  /**
   * 是否已完成
   */
  get settled(): boolean {
    return this._settled
  }
}
