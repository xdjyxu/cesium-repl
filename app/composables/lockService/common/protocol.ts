import type { Observable } from 'rxjs'
import type { InjectionKey } from 'vue'

/**
 * 文件锁定状态
 */
export interface FileLockState {
  /** 文件路径 */
  path: string
  /** 是否有未保存的修改（dirty） */
  dirty: boolean
  /** 是否被固定（pinned） */
  pinned: boolean
}

/**
 * 锁定状态变更事件类型
 */
export type LockChangeType = 'dirty' | 'clean' | 'pin' | 'unpin'

/**
 * 锁定状态变更事件
 */
export interface LockChangeEvent {
  type: LockChangeType
  path: string
}

/**
 * 文件锁定管理服务协议
 *
 * 管理两种锁定状态：
 * - dirty: 文件已编辑但未保存
 * - pinned: 用户主动固定的 tab
 */
export interface LockService {
  /** 所有文件的锁定状态流 */
  lockStates$: Observable<Map<string, FileLockState>>

  /** 锁定状态变更事件流 */
  lockChange$: Observable<LockChangeEvent>

  /**
   * 设置文件的 dirty 状态
   * @param path 文件路径
   * @param dirty 是否 dirty
   */
  setDirty: (path: string, dirty: boolean) => void

  /**
   * 设置文件的 pinned 状态
   * @param path 文件路径
   * @param pinned 是否 pinned
   */
  setPinned: (path: string, pinned: boolean) => void

  /**
   * 获取文件的锁定状态
   * @param path 文件路径
   * @returns 锁定状态，如果文件不存在则返回默认状态
   */
  getLockState: (path: string) => FileLockState

  /**
   * 判断文件是否 dirty
   * @param path 文件路径
   */
  isDirty: (path: string) => boolean

  /**
   * 判断文件是否 pinned
   * @param path 文件路径
   */
  isPinned: (path: string) => boolean

  /**
   * 判断文件是否被锁定（dirty 或 pinned）
   * @param path 文件路径
   */
  isLocked: (path: string) => boolean

  /**
   * 移除文件的锁定状态（文件关闭时调用）
   * @param path 文件路径
   */
  remove: (path: string) => void

  /**
   * 清空所有锁定状态
   */
  clear: () => void

  /**
   * 释放资源
   */
  dispose: () => void
}

// eslint-disable-next-line ts/no-redeclare
export const LockService = Symbol('LockService') as InjectionKey<LockService>
