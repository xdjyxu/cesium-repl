import type { Observable } from 'rxjs'
import type { InjectionKey } from 'vue'
import type { SandcastleShareData } from '../../shareService/common/protocol'

/**
 * 编译产物服务协议
 * 集中存储和分发编译产物，供 PreviewPanel 和 Standalone 按钮消费
 */
export interface ArtifactService {
  /**
   * 当前编译产物（响应式流）
   * 初始值为 null，每次编译完成后更新
   */
  artifact$: Observable<SandcastleShareData | null>

  /**
   * 写入新的编译产物
   * 由 useAutoCompile 在编译完成后调用
   */
  setArtifact: (data: SandcastleShareData | null) => void

  /**
   * 同步读取当前产物
   */
  getArtifact: () => SandcastleShareData | null
}

// eslint-disable-next-line ts/no-redeclare
export const ArtifactService = Symbol('ArtifactService') as InjectionKey<ArtifactService>
