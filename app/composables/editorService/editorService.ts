import type { EditorFile, EditorService, FileLanguage, ModelContentChangeEvent } from './protocol'
import * as monaco from 'monaco-editor'
import { Subject } from 'rxjs'
import {
  DEFAULT_LANGUAGE,
  EXTENSION_TO_LANGUAGE,
} from './protocol'

/**
 * Monaco Editor 服务实现
 */
export class EditorServiceImpl implements EditorService {
  /**
   * Model 内容变化事件的 Subject
   */
  private readonly _modelContentChangeSubject = new Subject<ModelContentChangeEvent>()

  /**
   * Model 内容变化事件流（只读）
   */
  readonly modelContentChange$ = this._modelContentChangeSubject.asObservable()

  /**
   * 存储 model 的监听器，用于清理
   */
  private readonly _modelListeners = new Map<string, monaco.IDisposable>()

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
  createOrGetModel(
    path: string,
    content: string,
    language?: FileLanguage,
  ): monaco.editor.ITextModel {
    const uri = monaco.Uri.parse(`file:///${path}`)

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

    return model
  }

  /**
   * 获取已存在的 Model
   */
  getModel(path: string): monaco.editor.ITextModel | null {
    const uri = monaco.Uri.parse(`file:///${path}`)
    return monaco.editor.getModel(uri)
  }

  /**
   * 更新 Model 内容
   */
  updateModel(path: string, content: string): void {
    const model = this.getModel(path)
    if (model && model.getValue() !== content) {
      model.setValue(content)
    }
  }

  /**
   * 删除 Model
   */
  deleteModel(path: string): void {
    const model = this.getModel(path)
    if (model) {
      // 先移除监听器
      this._detachModelListener(path)
      // 再销毁 model
      model.dispose()
    }
  }

  /**
   * 获取所有 Models
   */
  getAllModels(): EditorFile[] {
    const models = monaco.editor.getModels()

    return models.map((model) => {
      const uri = model.uri.toString()
      // 从 file:/// 格式中提取路径
      const path = uri.replace(/^file:\/\/\//, '')

      return {
        path,
        language: model.getLanguageId() as FileLanguage,
        model,
        content: model.getValue(),
      }
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

    // 销毁所有 models
    const models = monaco.editor.getModels()
    models.forEach(model => model.dispose())
  }
}

/**
 * 创建编辑器服务实例
 */
export function createEditorService(): EditorService {
  return new EditorServiceImpl()
}
