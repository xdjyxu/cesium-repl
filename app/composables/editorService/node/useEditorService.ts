import { createPluginService, createUseService } from '../../inject'
import { EditorService } from '../common/protocol'
import { ServerEditorServiceImpl } from './editorService'

export const useEditorService = createUseService(EditorService)

export const registerServerEditorService = createPluginService(
  EditorService,
  ServerEditorServiceImpl,
)
