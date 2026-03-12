import type { FileLockState, LockChangeEvent, LockService } from './protocol'
import { BehaviorSubject, Subject } from 'rxjs'

/**
 * 文件锁定管理服务实现
 */
export class LockServiceImpl implements LockService {
  private readonly _lockStatesSubject = new BehaviorSubject<Map<string, FileLockState>>(new Map())
  private readonly _lockChangeSubject = new Subject<LockChangeEvent>()

  readonly lockStates$ = this._lockStatesSubject.asObservable()
  readonly lockChange$ = this._lockChangeSubject.asObservable()

  setDirty(path: string, dirty: boolean): void {
    const states = this._lockStatesSubject.value
    const current = states.get(path) || { path, dirty: false, pinned: false }

    if (current.dirty === dirty) {
      return
    }

    const updated = { ...current, dirty }
    const newStates = new Map(states)
    newStates.set(path, updated)

    this._lockStatesSubject.next(newStates)
    this._lockChangeSubject.next({ type: dirty ? 'dirty' : 'clean', path })
  }

  setPinned(path: string, pinned: boolean): void {
    const states = this._lockStatesSubject.value
    const current = states.get(path) || { path, dirty: false, pinned: false }

    if (current.pinned === pinned) {
      return
    }

    const updated = { ...current, pinned }
    const newStates = new Map(states)
    newStates.set(path, updated)

    this._lockStatesSubject.next(newStates)
    this._lockChangeSubject.next({ type: pinned ? 'pin' : 'unpin', path })
  }

  getLockStates(): Map<string, FileLockState> {
    return this._lockStatesSubject.value
  }

  getLockState(path: string): FileLockState {
    const states = this._lockStatesSubject.value
    return states.get(path) || { path, dirty: false, pinned: false }
  }

  isDirty(path: string): boolean {
    return this.getLockState(path).dirty
  }

  isPinned(path: string): boolean {
    return this.getLockState(path).pinned
  }

  isLocked(path: string): boolean {
    const state = this.getLockState(path)
    return state.dirty || state.pinned
  }

  remove(path: string): void {
    const states = this._lockStatesSubject.value
    if (!states.has(path)) {
      return
    }

    const newStates = new Map(states)
    newStates.delete(path)
    this._lockStatesSubject.next(newStates)
  }

  clear(): void {
    this._lockStatesSubject.next(new Map())
  }

  dispose(): void {
    this._lockStatesSubject.complete()
    this._lockChangeSubject.complete()
  }
}

/**
 * 创建锁定服务实例
 */
export function createLockService(): LockService {
  return new LockServiceImpl()
}
