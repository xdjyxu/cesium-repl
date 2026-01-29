import type { Observable } from 'rxjs'
import type { InjectionKey } from 'vue'

/**
 * 存储变化事件
 */
export interface StoreChangeEvent<T = unknown> {
  /**
   * 键名
   */
  key: string

  /**
   * 旧值（如果键不存在则为 null）
   */
  oldValue: T | null

  /**
   * 新值（如果是删除操作则为 null）
   */
  newValue: T | null

  /**
   * 操作类型
   */
  operation: 'set' | 'remove' | 'clear'
}

/**
 * 存储服务接口
 * 提供异步的键值对存储功能
 * 当前实现使用 LocalStorage，未来可迁移到 IndexedDB
 */
export interface StoreService {
  /**
   * 存储变化事件流
   * 监听所有键的变化（set、remove、clear 操作）
   */
  change$: Observable<StoreChangeEvent>
  /**
   * 获取指定键的值
   * @param key - 键名
   * @returns 值，如果不存在则返回 null
   */
  get: <T = unknown>(key: string) => Promise<T | null>

  /**
   * 设置指定键的值
   * @param key - 键名
   * @param value - 要存储的值（会自动序列化为 JSON）
   */
  set: <T = unknown>(key: string, value: T) => Promise<void>

  /**
   * 删除指定键
   * @param key - 键名
   */
  remove: (key: string) => Promise<void>

  /**
   * 清空所有存储的数据
   */
  clear: () => Promise<void>

  /**
   * 获取所有键名
   * @returns 所有键名的数组
   */
  keys: () => Promise<string[]>

  /**
   * 检查指定键是否存在
   * @param key - 键名
   * @returns 如果键存在则返回 true
   */
  has: (key: string) => Promise<boolean>

  /**
   * 释放所有资源（包括跨标签页事件监听器）
   */
  dispose: () => void
}

// eslint-disable-next-line ts/no-redeclare
export const StoreService = Symbol('StoreService') as InjectionKey<StoreService>
