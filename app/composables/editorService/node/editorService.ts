import type * as monaco from 'monaco-editor'
import type { Observable } from 'rxjs'
import type { EditorService, FileLanguage, ModelContentChangeEvent } from '../common/protocol'
import { EMPTY } from 'rxjs'
import { DEFAULT_LANGUAGE, EXTENSION_TO_LANGUAGE } from '../common/protocol'

/**
 * 服务端 Editor 占位实现
 * Monaco Editor 依赖 window 和 DOM，无法在 SSR 环境中运行
 * 此实现仅用于避免服务端缺少 provider 报错
 */
export class ServerEditorServiceImpl implements EditorService {
  readonly modelContentChange$: Observable<ModelContentChangeEvent> = EMPTY
  readonly files$: Observable<string[]> = EMPTY

  createOrGetModel(
    _path: string,
    _content: string,
    _language?: FileLanguage,
  ): Promise<monaco.editor.ITextModel> {
    return Promise.reject(new Error('EditorService is not available in SSR context'))
  }

  getModel(_path: string): monaco.editor.ITextModel | null {
    return null
  }

  updateModel(_path: string, _content: string): void {}

  deleteModel(_path: string): void {}

  detectLanguage(path: string): FileLanguage {
    const extension = path.substring(path.lastIndexOf('.')).toLowerCase()
    return EXTENSION_TO_LANGUAGE[extension] || DEFAULT_LANGUAGE
  }

  createEditor(_container: HTMLElement): Promise<monaco.editor.IStandaloneCodeEditor> {
    return Promise.reject(new Error('EditorService is not available in SSR context'))
  }

  dispose(): void {}
}
