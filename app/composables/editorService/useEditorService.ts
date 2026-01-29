import { createProvideService, createUseService } from '../inject'
import { EditorServiceImpl } from './editorService'
import { EditorService } from './protocol'

export const useEditorService = createUseService(EditorService)

export const provideEditorService = createProvideService(EditorService, EditorServiceImpl)
