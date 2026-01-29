import type { StoreChangeEvent, StoreService } from './protocol'
import { Subject } from 'rxjs'

/**
 * 存储服务实现
 * 基于 LocalStorage 的异步键值对存储
 * 所有值会自动序列化为 JSON 格式存储
 */
export class StoreServiceImpl implements StoreService {
  private readonly prefix: string

  /**
   * 存储变化事件的 Subject
   */
  private readonly _changeSubject = new Subject<StoreChangeEvent>()

  /**
   * 存储变化事件流（只读）
   */
  readonly change$ = this._changeSubject.asObservable()

  /**
   * storage 事件监听器（用于跨标签页同步）
   */
  private readonly _storageListener: (event: StorageEvent) => void

  /**
   * @param prefix - 键名前缀，用于避免命名冲突（默认: 'cesium-repl:'）
   */
  constructor(prefix: string = 'cesium-repl:') {
    this.prefix = prefix

    // 监听其他标签页的 storage 变化
    this._storageListener = this._handleStorageEvent.bind(this)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this._storageListener)
    }
  }

  /**
   * 处理跨标签页的 storage 事件
   */
  private _handleStorageEvent(event: StorageEvent): void {
    // 只处理带有我们前缀的键
    if (!event.key || !event.key.startsWith(this.prefix)) {
      return
    }

    const key = this.removePrefix(event.key)

    try {
      // 解析旧值和新值
      const oldValue = event.oldValue ? JSON.parse(event.oldValue) : null
      const newValue = event.newValue ? JSON.parse(event.newValue) : null

      // 判断操作类型
      let operation: StoreChangeEvent['operation']
      if (event.newValue === null) {
        operation = 'remove'
      }
      else {
        operation = 'set'
      }

      // 触发变化事件
      this._changeSubject.next({
        key,
        oldValue,
        newValue,
        operation,
      })
    }
    catch (error) {
      console.error('Failed to parse storage event:', error)
    }
  }

  /**
   * 释放所有资源
   */
  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this._storageListener)
    }
    this._changeSubject.complete()
  }

  /**
   * 获取完整的键名（带前缀）
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`
  }

  /**
   * 从完整键名中移除前缀
   */
  private removePrefix(fullKey: string): string {
    return fullKey.startsWith(this.prefix)
      ? fullKey.slice(this.prefix.length)
      : fullKey
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key)
      const value = localStorage.getItem(fullKey)

      if (value === null) {
        return null
      }

      return JSON.parse(value) as T
    }
    catch (error) {
      console.error(`Failed to get key "${key}":`, error)
      return null
    }
  }

  /**
   * 触发变化事件
   */
  private emitChange<T = unknown>(
    key: string,
    oldValue: T | null,
    newValue: T | null,
    operation: StoreChangeEvent['operation'],
  ): void {
    this._changeSubject.next({
      key,
      oldValue,
      newValue,
      operation,
    })
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    try {
      // 获取旧值
      const oldValue = await this.get<T>(key)

      const fullKey = this.getFullKey(key)
      const serialized = JSON.stringify(value)
      localStorage.setItem(fullKey, serialized)

      // 触发变化事件
      this.emitChange(key, oldValue, value, 'set')
    }
    catch (error) {
      console.error(`Failed to set key "${key}":`, error)
      throw error
    }
  }

  async remove(key: string): Promise<void> {
    try {
      // 获取旧值
      const oldValue = await this.get(key)

      const fullKey = this.getFullKey(key)
      localStorage.removeItem(fullKey)

      // 触发变化事件
      this.emitChange(key, oldValue, null, 'remove')
    }
    catch (error) {
      console.error(`Failed to remove key "${key}":`, error)
      throw error
    }
  }

  async clear(): Promise<void> {
    try {
      // 只清除带有指定前缀的键
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key)
        }
      }

      // 获取所有旧值并触发事件
      for (const fullKey of keysToRemove) {
        const key = this.removePrefix(fullKey)
        const oldValue = await this.get(key)
        localStorage.removeItem(fullKey)

        // 为每个被清除的键触发事件
        this.emitChange(key, oldValue, null, 'clear')
      }
    }
    catch (error) {
      console.error('Failed to clear storage:', error)
      throw error
    }
  }

  async keys(): Promise<string[]> {
    try {
      const keys: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.prefix)) {
          keys.push(this.removePrefix(key))
        }
      }

      return keys
    }
    catch (error) {
      console.error('Failed to get keys:', error)
      return []
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key)
      return localStorage.getItem(fullKey) !== null
    }
    catch (error) {
      console.error(`Failed to check key "${key}":`, error)
      return false
    }
  }
}
