import type * as monaco from 'monaco-editor'
import type { EditorService, FileLanguage, ModelContentChangeEvent } from '../common/protocol'
import CESIUM_MODULE_DECLARATION from 'cesium/Source/Cesium.d.ts?raw'
import { BehaviorSubject, Subject } from 'rxjs'
import { SANDCASTLE_MODULE_DECLARATION } from '~/utils/sandcastle'
import { Autowired, PostInject } from '../../inject'
import { MonacoLoaderService } from '../../monacoLoaderService/common/protocol'
import {
  DEFAULT_LANGUAGE,
  EXTENSION_TO_LANGUAGE,
} from '../common/protocol'

/**
 * Monaco Editor 服务实现
 */
export class EditorServiceImpl implements EditorService {
  /**
   * Monaco Loader 服务（自动注入）
   */
  @Autowired(MonacoLoaderService)
  private readonly _monacoLoader!: MonacoLoaderService

  /**
   * Monaco 实例（在初始化后可用）
   */
  private _monaco?: typeof monaco

  /**
   * 初始化 Promise，用于等待 Monaco 加载完成
   */
  private _initializePromise?: Promise<void>

  /**
   * Model 内容变化事件的 Subject
   */
  private readonly _modelContentChangeSubject = new Subject<ModelContentChangeEvent>()

  /**
   * Model 内容变化事件流（只读）
   */
  readonly modelContentChange$ = this._modelContentChangeSubject.asObservable()

  /**
   * 当前所有已注册文件路径的 Subject
   */
  private readonly _filesSubject = new BehaviorSubject<string[]>([])

  /**
   * 当前所有已注册文件路径列表（随 createOrGetModel / deleteModel 更新）
   */
  readonly files$ = this._filesSubject.asObservable()

  /**
   * 存储 model 的监听器，用于清理
   */
  private readonly _modelListeners = new Map<string, { dispose: () => void }>()

  /**
   * 初始化方法，在依赖注入后自动执行
   * 等待 Monaco Editor 加载完成，并注入 Sandcastle 类型声明
   */
  @PostInject
  async initialize(): Promise<void> {
    this._monaco = await this._monacoLoader.getMonaco()
    this._injectSandcastleTypes(this._monaco)
    this._injectCesiumTypes(this._monaco)
  }

  /**
   * 向 Monaco TypeScript/JavaScript 语言服务注入 Sandcastle 模块类型
   * 注入后用户代码可通过 `import * as Sandcastle from 'Sandcastle'` 获得完整的类型提示
   */
  private _injectSandcastleTypes(monacoInstance: typeof monaco): void {
    const libUri = 'file:///node_modules/@types/sandcastle/index.d.ts'
    monacoInstance.typescript.typescriptDefaults.addExtraLib(
      SANDCASTLE_MODULE_DECLARATION,
      libUri,
    )
    monacoInstance.typescript.javascriptDefaults.addExtraLib(
      SANDCASTLE_MODULE_DECLARATION,
      libUri,
    )
  }

  /**
   * 向 Monaco TypeScript/JavaScript 语言服务注入 Cesium 模块类型
   * 注入后用户代码可通过 `import * as Cesium from 'cesium'` 获得完整的类型提示
   */
  private _injectCesiumTypes(monacoInstance: typeof monaco): void {
    const libUri = 'file:///node_modules/cesium/Source/Cesium.d.ts'
    monacoInstance.typescript.typescriptDefaults.addExtraLib(
      CESIUM_MODULE_DECLARATION,
      libUri,
    )
    monacoInstance.typescript.javascriptDefaults.addExtraLib(
      CESIUM_MODULE_DECLARATION,
      libUri,
    )
  }

  /**
   * 确保 Monaco 已初始化
   * 在使用 _monaco 前必须调用此方法
   */
  private async _ensureMonaco(): Promise<typeof monaco> {
    if (this._monaco) {
      return this._monaco
    }

    // 如果没有初始化 Promise，创建一个
    if (!this._initializePromise) {
      this._initializePromise = this.initialize()
    }

    await this._initializePromise
    return this._monaco!
  }

  /**
   * 将文件路径规范化为 Monaco file URI
   * 去除前导斜杠，防止生成 file:////path 形式的非法 URI（Monaco 会抛出 UriError）
   * 例如：'/main.js' → 'file:///main.js'，而非 'file:////main.js'
   */
  private _pathToUri(monacoInstance: { Uri: typeof monaco.Uri }, path: string): monaco.Uri {
    return monacoInstance.Uri.parse(`file:///${path.replace(/^\/+/, '')}`)
  }

  /**
   * 为 model 添加内容变化监听器
   */
  private _attachModelListener(path: string, model: monaco.editor.ITextModel): void {
    // 如果已经有监听器，先移除
    this._detachModelListener(path)

    // 添加新的监听器
    const listener = model.onDidChangeContent((e) => {
      this._modelContentChangeSubject.next({
        path,
        content: model.getValue(),
        changes: e,
      })
    })

    this._modelListeners.set(path, listener)
  }

  /**
   * 移除 model 的监听器
   */
  private _detachModelListener(path: string): void {
    const listener = this._modelListeners.get(path)
    if (listener) {
      listener.dispose()
      this._modelListeners.delete(path)
    }
  }

  /**
   * 根据文件路径判断语言类型
   */
  detectLanguage(path: string): FileLanguage {
    const extension = path.substring(path.lastIndexOf('.')).toLowerCase()
    return EXTENSION_TO_LANGUAGE[extension] || DEFAULT_LANGUAGE
  }

  /**
   * 创建或获取文件的 Monaco Model
   */
  async createOrGetModel(
    path: string,
    content: string,
    language?: FileLanguage,
  ): Promise<monaco.editor.ITextModel> {
    const monaco = await this._ensureMonaco()
    const uri = this._pathToUri(monaco, path)

    // 尝试获取已存在的 model
    let model = monaco.editor.getModel(uri)

    if (model) {
      // 如果 model 已存在，更新内容
      if (model.getValue() !== content) {
        model.setValue(content)
      }

      // 如果提供了语言类型且与当前不同，更新语言
      if (language && model.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(model, language)
      }

      return model
    }

    // 创建新 model
    const detectedLanguage = language || this.detectLanguage(path)
    model = monaco.editor.createModel(content, detectedLanguage, uri)

    // 为新创建的 model 添加变化监听器
    this._attachModelListener(path, model)

    // 更新文件列表
    this._filesSubject.next([...this._filesSubject.value, path])

    return model
  }

  /**
   * 获取已存在的 Model
   * Monaco 未初始化时返回 null
   */
  getModel(path: string): monaco.editor.ITextModel | null {
    if (!this._monaco) {
      return null
    }
    const uri = this._pathToUri(this._monaco, path)
    return this._monaco.editor.getModel(uri)
  }

  /**
   * 更新 Model 内容
   * Monaco 未初始化时不执行任何操作
   */
  updateModel(path: string, content: string): void {
    const model = this.getModel(path)
    if (model && model.getValue() !== content) {
      model.setValue(content)
    }
  }

  /**
   * 删除 Model
   * Monaco 未初始化时不执行任何操作
   */
  deleteModel(path: string): void {
    const model = this.getModel(path)
    if (model) {
      // 先移除监听器
      this._detachModelListener(path)
      // 再销毁 model
      model.dispose()
      // 更新文件列表
      this._filesSubject.next(this._filesSubject.value.filter(p => p !== path))
    }
  }

  /**
   * 创建 Monaco Editor 实例并挂载到指定容器
   */
  async createEditor(container: HTMLElement): Promise<monaco.editor.IStandaloneCodeEditor> {
    const monacoInstance = await this._ensureMonaco()
    return monacoInstance.editor.create(container, {
      automaticLayout: true,
      fontSize: 14,
      minimap: {
        enabled: true,
      },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      tabSize: 2,
      insertSpaces: true,
    })
  }

  /**
   * 释放所有资源
   */
  dispose(): void {
    // 清理所有监听器
    this._modelListeners.forEach(listener => listener.dispose())
    this._modelListeners.clear()

    // 关闭 Subject
    this._modelContentChangeSubject.complete()
    this._filesSubject.complete()

    // 销毁所有 models（如果 monaco 已初始化）
    if (this._monaco) {
      const models = this._monaco.editor.getModels()
      models.forEach(model => model.dispose())
    }
  }
}

/**
 * 创建编辑器服务实例
 */
export function createEditorService(): EditorService {
  return new EditorServiceImpl()
}
