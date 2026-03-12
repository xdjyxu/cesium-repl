import type { Observable } from 'rxjs'
import type { FileLockState, LockChangeEvent, LockService } from '../common/protocol'
import { EMPTY, of } from 'rxjs'

const DEFAULT_STATE: FileLockState = { path: '', dirty: false, pinned: false }

/**
 * 锁定服务 SSR 占位实现
 * 提供无操作的实现以满足 provide/inject 需求
 */
export class ServerLockServiceImpl implements LockService {
  readonly lockStates$: Observable<Map<string, FileLockState>> = of(new Map())
  readonly lockChange$: Observable<LockChangeEvent> = EMPTY

  setDirty(_path: string, _dirty: boolean): void {}
  setPinned(_path: string, _pinned: boolean): void {}

  getLockStates(): Map<string, FileLockState> { return new Map() }

  getLockState(path: string): FileLockState {
    return { ...DEFAULT_STATE, path }
  }

  isDirty(_path: string): boolean { return false }
  isPinned(_path: string): boolean { return false }
  isLocked(_path: string): boolean { return false }

  remove(_path: string): void {}
  clear(): void {}
  dispose(): void {}
}
