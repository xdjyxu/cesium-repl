import type { Observable } from 'rxjs'
import type { InjectionKey } from 'vue'

/**
 * 已打开的 Tab 信息
 */
export interface Tab {
  /** 文件路径 */
  path: string
  /** 是否锁定（锁定后不可关闭） */
  locked: boolean
}

/**
 * Tab 变更事件类型
 */
export type TabChangeType = 'open' | 'close' | 'activate' | 'lock' | 'unlock'

/**
 * Tab 变更事件
 */
export interface TabChangeEvent {
  type: TabChangeType
  path: string
}

/**
 * Tab 管理服务协议
 */
export interface TabService {
  /** 当前所有打开的 Tab 列表 */
  tabs$: Observable<Tab[]>
  /** 当前激活的 Tab 路径（null 表示无激活） */
  activeTab$: Observable<string | null>
  /** Tab 变更事件流（open/close/activate/lock/unlock） */
  tabChange$: Observable<TabChangeEvent>

  /** 打开 Tab（若已存在则仅激活） */
  openTab: (path: string) => void
  /** 关闭 Tab（锁定的 Tab 不会被关闭） */
  closeTab: (path: string) => void
  /** 激活指定 Tab */
  activateTab: (path: string) => void
  /** 锁定 Tab（防止被关闭） */
  lockTab: (path: string) => void
  /** 解锁 Tab */
  unlockTab: (path: string) => void
  /** 获取当前激活的 Tab 路径 */
  getActiveTab: () => string | null
  /** 判断指定路径的 Tab 是否已打开 */
  isOpen: (path: string) => boolean
  /** 强制关闭所有 Tab（忽略锁定状态），用于切换示例等场景 */
  closeAll: () => void
  /** 释放资源 */
  dispose: () => void
}

// eslint-disable-next-line ts/no-redeclare
export const TabService = Symbol('TabService') as InjectionKey<TabService>
