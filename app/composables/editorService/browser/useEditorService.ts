import { createPluginService, createUseService } from '../../inject'
import { EditorServiceImpl } from './editorService'
import { EditorService } from '../common/protocol'

export const useEditorService = createUseService(EditorService)

export const registerEditorService = createPluginService(EditorService, EditorServiceImpl, {
  executeLifecycle: true,
})
