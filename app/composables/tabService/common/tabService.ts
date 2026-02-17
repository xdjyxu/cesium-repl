import type { Tab, TabChangeEvent, TabService } from './protocol'
import { BehaviorSubject, Subject } from 'rxjs'

/**
 * Tab 管理服务实现（纯内存，无浏览器依赖，可在 SSR/浏览器通用）
 */
export class TabServiceImpl implements TabService {
  private readonly _tabsSubject = new BehaviorSubject<Tab[]>([])
  private readonly _activeTabSubject = new BehaviorSubject<string | null>(null)
  private readonly _tabChangeSubject = new Subject<TabChangeEvent>()
  /** 激活历史（按时间顺序，最近激活在末尾） */
  private readonly _activationHistory: string[] = []

  readonly tabs$ = this._tabsSubject.asObservable()
  readonly activeTab$ = this._activeTabSubject.asObservable()
  readonly tabChange$ = this._tabChangeSubject.asObservable()

  openTab(path: string): void {
    const tabs = this._tabsSubject.value
    if (!tabs.some(t => t.path === path)) {
      this._tabsSubject.next([...tabs, { path, locked: false }])
      this._tabChangeSubject.next({ type: 'open', path })
    }
    this.activateTab(path)
  }

  closeTab(path: string): void {
    const tabs = this._tabsSubject.value
    const tab = tabs.find(t => t.path === path)
    if (!tab || tab.locked)
      return

    const newTabs = tabs.filter(t => t.path !== path)
    this._tabsSubject.next(newTabs)
    this._tabChangeSubject.next({ type: 'close', path })

    // 从激活历史中完全清除被关闭的 Tab
    const purged = this._activationHistory.filter(p => p !== path)
    this._activationHistory.length = 0
    this._activationHistory.push(...purged)

    // 如果被关闭的 Tab 是当前激活的，按历史激活上一个
    if (this._activeTabSubject.value === path) {
      const nextActive = this._activationHistory.at(-1) ?? null
      this._activeTabSubject.next(nextActive)
      if (nextActive) {
        this._tabChangeSubject.next({ type: 'activate', path: nextActive })
      }
    }
  }

  activateTab(path: string): void {
    if (this._activeTabSubject.value === path)
      return
    this._activationHistory.push(path)
    this._activeTabSubject.next(path)
    this._tabChangeSubject.next({ type: 'activate', path })
  }

  lockTab(path: string): void {
    const tabs = this._tabsSubject.value
    const tab = tabs.find(t => t.path === path)
    if (!tab || tab.locked)
      return
    this._tabsSubject.next(tabs.map(t => t.path === path ? { ...t, locked: true } : t))
    this._tabChangeSubject.next({ type: 'lock', path })
  }

  unlockTab(path: string): void {
    const tabs = this._tabsSubject.value
    const tab = tabs.find(t => t.path === path)
    if (!tab || !tab.locked)
      return
    this._tabsSubject.next(tabs.map(t => t.path === path ? { ...t, locked: false } : t))
    this._tabChangeSubject.next({ type: 'unlock', path })
  }

  getActiveTab(): string | null {
    return this._activeTabSubject.value
  }

  isOpen(path: string): boolean {
    return this._tabsSubject.value.some(t => t.path === path)
  }

  closeAll(): void {
    const paths = this._tabsSubject.value.map(t => t.path)
    this._tabsSubject.next([])
    this._activeTabSubject.next(null)
    this._activationHistory.length = 0
    paths.forEach(path => this._tabChangeSubject.next({ type: 'close', path }))
  }

  dispose(): void {
    this._tabsSubject.complete()
    this._activeTabSubject.complete()
    this._tabChangeSubject.complete()
  }
}
