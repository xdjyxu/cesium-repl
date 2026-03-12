import { createPluginService, createUseService } from '../../inject'
import { EditorService } from '../common/protocol'
import { EditorServiceImpl } from './editorService'

export const useEditorService = createUseService(EditorService)

export const registerEditorService = createPluginService(EditorService, EditorServiceImpl, {
  executeLifecycle: true,
})
