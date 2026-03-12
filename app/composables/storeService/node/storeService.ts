import type { Observable } from 'rxjs'
import type { StoreChangeEvent, StoreService } from '../common/protocol'
import { EMPTY } from 'rxjs'

/**
 * 服务端存储服务实现（内存版本）
 * 用于 SSR 环境，不依赖 localStorage
 */
export class ServerStoreServiceImpl implements StoreService {
  private readonly _store = new Map<string, string>()

  readonly change$: Observable<StoreChangeEvent> = EMPTY

  async get<T = unknown>(key: string): Promise<T | null> {
    const val = this._store.get(key)
    return val !== undefined ? JSON.parse(val) as T : null
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this._store.set(key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    this._store.delete(key)
  }

  async clear(): Promise<void> {
    this._store.clear()
  }

  async keys(): Promise<string[]> {
    return Array.from(this._store.keys())
  }

  async has(key: string): Promise<boolean> {
    return this._store.has(key)
  }

  dispose(): void {
    this._store.clear()
  }
}
