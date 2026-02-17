import { createPluginService, createUseService } from '../../inject'
import { FileServiceImpl } from './fileService'
import { FileService } from './protocol'

export const useFileService = createUseService(FileService)

export const registerFileService = createPluginService(FileService, FileServiceImpl)
