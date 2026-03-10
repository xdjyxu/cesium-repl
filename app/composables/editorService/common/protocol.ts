import type * as monaco from 'monaco-editor'
import type { Observable } from 'rxjs'
import type { InjectionKey } from 'vue'

/**
 * 文件语言类型
 */
export type FileLanguage = 'typescript' | 'javascript' | 'html' | 'css' | 'json' | 'plaintext'

/**
 * Model 内容变化事件
 */
export interface ModelContentChangeEvent {
  /**
   * 文件路径
   */
  path: string

  /**
   * 新内容
   */
  content: string

  /**
   * Monaco 编辑器的变化事件
   */
  changes: monaco.editor.IModelContentChangedEvent
}

/**
 * 编辑器文件信息
 */
export interface EditorFile {
  /**
   * 文件路径（作为 URI）
   */
  path: string

  /**
   * 文件语言类型
   */
  language: FileLanguage

  /**
   * Monaco Editor Model
   */
  model: monaco.editor.ITextModel

  /**
   * 文件内容
   */
  content: string
}

/**
 * 编辑器服务接口
 */
export interface EditorService {
  /**
   * Model 内容变化事件流
   */
  modelContentChange$: Observable<ModelContentChangeEvent>

  /**
   * 当前所有已注册的文件路径列表（响应式，随 createOrGetModel / deleteModel 更新）
   */
  files$: Observable<string[]>

  /**
   * 创建或获取文件的 Monaco Model
   * 如果 Monaco 未初始化，会等待初始化完成
   * @param path 文件路径
   * @param content 文件内容
   * @param language 可选的语言类型，如果不提供则根据文件后缀自动判断
   */
  createOrGetModel: (path: string, content: string, language?: FileLanguage) => Promise<monaco.editor.ITextModel>

  /**
   * 获取已存在的 Model
   * Monaco 未初始化时返回 null
   * @param path 文件路径
   */
  getModel: (path: string) => monaco.editor.ITextModel | null

  /**
   * 更新 Model 内容
   * Monaco 未初始化时不执行任何操作
   * @param path 文件路径
   * @param content 新内容
   */
  updateModel: (path: string, content: string) => void

  /**
   * 删除 Model
   * Monaco 未初始化时不执行任何操作
   * @param path 文件路径
   */
  deleteModel: (path: string) => void

  /**
   * 根据文件路径判断语言类型
   * @param path 文件路径
   */
  detectLanguage: (path: string) => FileLanguage

  /**
   * 获取当前所有已注册的文件路径列表（同步）
   * @returns 文件路径数组
   */
  getFiles: () => string[]

  /**
   * 创建 Monaco Editor 实例并挂载到指定容器
   * @param container 编辑器容器 DOM 元素
   * @returns 创建的编辑器实例
   */
  createEditor: (container: HTMLElement) => Promise<monaco.editor.IStandaloneCodeEditor>

  /**
   * 保存 Model 内容到 FileService
   * 将 Monaco Model 的当前内容写入虚拟文件系统
   * @param path 文件路径
   * @returns 保存是否成功
   */
  saveModel: (path: string) => Promise<boolean>

  /**
   * 获取 Model 的当前内容
   * @param path 文件路径
   * @returns Model 内容，如果 Model 不存在则返回 null
   */
  getModelContent: (path: string) => string | null

  /**
   * 释放所有资源
   */
  dispose: () => void
}

// eslint-disable-next-line ts/no-redeclare
export const EditorService = Symbol('EditorService') as InjectionKey<EditorService>

/**
 * 文件扩展名到语言的映射
 */
export const EXTENSION_TO_LANGUAGE: Record<string, FileLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.json': 'json',
}

/**
 * 默认语言
 */
export const DEFAULT_LANGUAGE: FileLanguage = 'plaintext'
