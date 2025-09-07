import type { Observable } from 'rxjs'
import { createEventHook, createSharedComposable } from '@vueuse/core'
import { useSubscription } from '@vueuse/rxjs'
import { BehaviorSubject } from 'rxjs'
import { computed, readonly, ref } from 'vue'

export interface FileSystemEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: Date
  created: Date
  content: string
  locked: boolean
}

export type FileSystemChangeType = 'created' | 'modified' | 'deleted' | 'moved' | 'locked' | 'unlocked'

export interface FileSystemChangeEvent<T extends FileSystemChangeType = FileSystemChangeType> {
  type: T
  path: string
  oldPath?: T extends 'moved' ? string : never
  entry?: FileSystemEntry
  timestamp: Date
}

// Specific event type aliases for better type safety
export type FileCreatedEvent = FileSystemChangeEvent<'created'>
export type FileModifiedEvent = FileSystemChangeEvent<'modified'>
export type FileDeletedEvent = FileSystemChangeEvent<'deleted'>
export type FileMovedEvent = FileSystemChangeEvent<'moved'>
export type FileLockedEvent = FileSystemChangeEvent<'locked'>
export type FileUnlockedEvent = FileSystemChangeEvent<'unlocked'>

export interface FileSystemState {
  files: Map<string, FileSystemEntry>
  isLoading: boolean
  error: string | null
}

class MemoryFileSystem {
  private files: Map<string, FileSystemEntry> = new Map()
  private changesSubject: BehaviorSubject<FileSystemChangeEvent | null>

  constructor() {
    // Initialize with root directory
    const rootEntry: FileSystemEntry = {
      name: '',
      path: '/',
      isDirectory: true,
      size: 0,
      modified: new Date(),
      created: new Date(),
      content: '',
      locked: false,
    }
    this.files.set('/', rootEntry)
    this.changesSubject = new BehaviorSubject<FileSystemChangeEvent | null>(null)
  }

  get changes$(): Observable<FileSystemChangeEvent | null> {
    return this.changesSubject.asObservable()
  }

  private emitChange(event: FileSystemChangeEvent): void {
    this.changesSubject.next(event)
  }

  get allFiles(): Map<string, FileSystemEntry> {
    return new Map(this.files)
  }

  private normalizePath(path: string): string {
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  }

  private getFileName(path: string): string {
    const normalizedPath = this.normalizePath(path)
    if (normalizedPath === '/')
      return ''
    const parts = normalizedPath.split('/')
    return parts[parts.length - 1] || ''
  }

  private getParentPath(path: string): string {
    const normalizedPath = this.normalizePath(path)
    if (normalizedPath === '/')
      return '/'
    const lastSlashIndex = normalizedPath.lastIndexOf('/')
    return lastSlashIndex <= 0 ? '/' : normalizedPath.substring(0, lastSlashIndex)
  }

  private ensureParentExists(path: string): void {
    const parentPath = this.getParentPath(path)
    if (parentPath === '/' || this.files.has(parentPath)) {
      return
    }

    // Recursively create parent directories
    this.ensureParentExists(parentPath)

    const parentEntry: FileSystemEntry = {
      name: this.getFileName(parentPath),
      path: parentPath,
      isDirectory: true,
      size: 0,
      modified: new Date(),
      created: new Date(),
      content: '',
      locked: false,
    }

    this.files.set(parentPath, parentEntry)
  }

  async exists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path)
    return this.files.has(normalizedPath)
  }

  async stat(path: string) {
    const normalizedPath = this.normalizePath(path)
    const entry = this.files.get(normalizedPath)
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`)
    }

    return {
      isDirectory: () => entry.isDirectory,
      isFile: () => !entry.isDirectory,
      size: entry.content.length,
      mtime: entry.modified,
      birthtime: entry.created,
    }
  }

  async readdir(path: string): Promise<string[]> {
    const normalizedPath = this.normalizePath(path)
    const entry = this.files.get(normalizedPath)
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`)
    }
    if (!entry.isDirectory) {
      throw new Error(`ENOTDIR: not a directory, scandir '${path}'`)
    }

    const children: string[] = []
    const pathPrefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`

    for (const [filePath] of this.files) {
      if (filePath !== normalizedPath && filePath.startsWith(pathPrefix)) {
        const relativePath = filePath.substring(pathPrefix.length)
        // Only include direct children (no nested paths)
        if (!relativePath.includes('/')) {
          const childEntry = this.files.get(filePath)
          if (childEntry) {
            children.push(childEntry.name)
          }
        }
      }
    }

    return children
  }

  async readFile(path: string): Promise<string> {
    const normalizedPath = this.normalizePath(path)
    const entry = this.files.get(normalizedPath)
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`)
    }
    if (entry.isDirectory) {
      throw new Error(`EISDIR: illegal operation on a directory, read '${path}'`)
    }

    return entry.content
  }

  async writeFile(path: string, content: string): Promise<void> {
    const normalizedPath = this.normalizePath(path)
    const existingEntry = this.files.get(normalizedPath)

    if (existingEntry) {
      if (existingEntry.isDirectory) {
        throw new Error(`EISDIR: illegal operation on a directory, open '${path}'`)
      }
      existingEntry.content = content
      existingEntry.size = content.length
      existingEntry.modified = new Date()

      this.emitChange({
        type: 'modified',
        path: normalizedPath,
        entry: existingEntry,
        timestamp: new Date(),
      })
    }
    else {
      this.ensureParentExists(normalizedPath)

      const newEntry: FileSystemEntry = {
        name: this.getFileName(normalizedPath),
        path: normalizedPath,
        isDirectory: false,
        size: content.length,
        modified: new Date(),
        created: new Date(),
        content,
        locked: false,
      }

      this.files.set(normalizedPath, newEntry)

      this.emitChange({
        type: 'created',
        path: normalizedPath,
        entry: newEntry,
        timestamp: new Date(),
      })
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(path)

    if (await this.exists(normalizedPath)) {
      throw new Error(`EEXIST: file already exists, mkdir '${path}'`)
    }

    if (options?.recursive) {
      this.ensureParentExists(normalizedPath)
    }
    else {
      const parentPath = this.getParentPath(normalizedPath)
      if (!(await this.exists(parentPath))) {
        throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`)
      }
    }

    const newEntry: FileSystemEntry = {
      name: this.getFileName(normalizedPath),
      path: normalizedPath,
      isDirectory: true,
      size: 0,
      modified: new Date(),
      created: new Date(),
      content: '',
      locked: false,
    }

    this.files.set(normalizedPath, newEntry)

    this.emitChange({
      type: 'created',
      path: normalizedPath,
      entry: newEntry,
      timestamp: new Date(),
    })
  }

  async unlink(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path)
    const entry = this.files.get(normalizedPath)
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`)
    }
    if (entry.isDirectory) {
      throw new Error(`EPERM: operation not permitted, unlink '${path}'`)
    }

    this.files.delete(normalizedPath)

    this.emitChange({
      type: 'deleted',
      path: normalizedPath,
      entry,
      timestamp: new Date(),
    })
  }

  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(path)
    const entry = this.files.get(normalizedPath)
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, rmdir '${path}'`)
    }
    if (!entry.isDirectory) {
      throw new Error(`ENOTDIR: not a directory, rmdir '${path}'`)
    }

    // Check if directory has children
    const hasChildren = Array.from(this.files.keys()).some(filePath =>
      filePath !== normalizedPath
      && filePath.startsWith(normalizedPath === '/' ? '/' : `${normalizedPath}/`),
    )

    if (!options?.recursive && hasChildren) {
      throw new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`)
    }

    if (options?.recursive && hasChildren) {
      // Delete all children recursively
      const childrenToDelete = Array.from(this.files.keys()).filter(filePath =>
        filePath !== normalizedPath
        && filePath.startsWith(normalizedPath === '/' ? '/' : `${normalizedPath}/`),
      )

      for (const childPath of childrenToDelete) {
        const childEntry = this.files.get(childPath)!
        this.files.delete(childPath)
        this.emitChange({
          type: 'deleted',
          path: childPath,
          entry: childEntry,
          timestamp: new Date(),
        })
      }
    }

    this.files.delete(normalizedPath)

    this.emitChange({
      type: 'deleted',
      path: normalizedPath,
      entry,
      timestamp: new Date(),
    })
  }

  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    const normalizedSourcePath = this.normalizePath(sourcePath)
    const sourceEntry = this.files.get(normalizedSourcePath)
    if (!sourceEntry) {
      throw new Error(`ENOENT: no such file or directory, open '${sourcePath}'`)
    }
    if (sourceEntry.isDirectory) {
      throw new Error(`EISDIR: illegal operation on a directory, read '${sourcePath}'`)
    }

    await this.writeFile(targetPath, sourceEntry.content)
  }

  async rename(sourcePath: string, targetPath: string): Promise<void> {
    const normalizedSourcePath = this.normalizePath(sourcePath)
    const normalizedTargetPath = this.normalizePath(targetPath)
    const sourceEntry = this.files.get(normalizedSourcePath)
    if (!sourceEntry) {
      throw new Error(`ENOENT: no such file or directory, rename '${sourcePath}'`)
    }

    if (sourceEntry.isDirectory) {
      // For directories, we need to move all children as well
      const childrenToMove = Array.from(this.files.entries()).filter(([filePath]) =>
        filePath.startsWith(normalizedSourcePath === '/' ? '/' : `${normalizedSourcePath}/`),
      )

      // Create new directory
      const newDirEntry: FileSystemEntry = {
        ...sourceEntry,
        name: this.getFileName(normalizedTargetPath),
        path: normalizedTargetPath,
        modified: new Date(),
      }
      this.files.set(normalizedTargetPath, newDirEntry)

      // Move all children
      for (const [childPath, childEntry] of childrenToMove) {
        const relativePath = childPath.substring(normalizedSourcePath.length)
        const newChildPath = normalizedTargetPath + relativePath
        const newChildEntry: FileSystemEntry = {
          ...childEntry,
          path: newChildPath,
        }
        this.files.set(newChildPath, newChildEntry)
        this.files.delete(childPath)
      }
    }
    else {
      // For files, just copy the entry with new path
      this.ensureParentExists(normalizedTargetPath)
      const newEntry: FileSystemEntry = {
        ...sourceEntry,
        name: this.getFileName(normalizedTargetPath),
        path: normalizedTargetPath,
        modified: new Date(),
      }
      this.files.set(normalizedTargetPath, newEntry)
    }

    // Delete source
    this.files.delete(normalizedSourcePath)

    const targetEntry = this.files.get(normalizedTargetPath)!
    this.emitChange({
      type: 'moved',
      path: normalizedTargetPath,
      oldPath: normalizedSourcePath,
      entry: targetEntry,
      timestamp: new Date(),
    })
  }

  async setLocked(path: string, locked: boolean): Promise<void> {
    const normalizedPath = this.normalizePath(path)
    const entry = this.files.get(normalizedPath)
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: '${path}'`)
    }

    const wasLocked = entry.locked
    entry.locked = locked
    entry.modified = new Date()

    if (wasLocked !== locked) {
      this.emitChange({
        type: locked ? 'locked' : 'unlocked',
        path: normalizedPath,
        entry,
        timestamp: new Date(),
      })
    }
  }

  async isLocked(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path)
    const entry = this.files.get(normalizedPath)
    return entry ? entry.locked : false
  }
}

function _useFileSystem() {
  const memfs = new MemoryFileSystem()

  const state = ref<FileSystemState>({
    files: new Map<string, FileSystemEntry>(),
    isLoading: false,
    error: null,
  })

  // Computed properties
  const allFiles = computed(() => new Map(state.value.files))
  const isLoading = computed(() => state.value.isLoading)
  const error = computed(() => state.value.error)

  // Reactive file tree helpers
  const getFilesByPath = computed(() => {
    const filesByPath = new Map<string, FileSystemEntry[]>()
    for (const entry of state.value.files.values()) {
      if (entry.isDirectory)
        continue
      const dirPath = entry.path.substring(0, entry.path.lastIndexOf('/')) || '/'
      if (!filesByPath.has(dirPath)) {
        filesByPath.set(dirPath, [])
      }
      filesByPath.get(dirPath)!.push(entry)
    }
    return filesByPath
  })

  const getDirectoriesByPath = computed(() => {
    const dirsByPath = new Map<string, FileSystemEntry[]>()
    for (const entry of state.value.files.values()) {
      if (!entry.isDirectory)
        continue
      const parentPath = entry.path.substring(0, entry.path.lastIndexOf('/')) || '/'
      if (!dirsByPath.has(parentPath)) {
        dirsByPath.set(parentPath, [])
      }
      dirsByPath.get(parentPath)!.push(entry)
    }
    return dirsByPath
  })

  const getChildrenByPath = (path: string = '/') => {
    const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '')
    return computed(() => {
      const children: FileSystemEntry[] = []
      const dirs = getDirectoriesByPath.value.get(normalizedPath) || []
      const files = getFilesByPath.value.get(normalizedPath) || []

      children.push(...dirs, ...files)
      return children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory)
          return -1
        if (!a.isDirectory && b.isDirectory)
          return 1
        return a.name.localeCompare(b.name)
      })
    })
  }

  const setError = (error: string | null) => {
    state.value.error = error
  }

  const setLoading = (loading: boolean) => {
    state.value.isLoading = loading
  }

  // Update state when filesystem changes
  const updateFileSystemState = () => {
    state.value.files = memfs.allFiles
  }

  // File system operations
  const createDirectory = async (path: string): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      await memfs.mkdir(path, { recursive: true })
      updateFileSystemState()
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create directory'
      setError(errorMessage)
      throw err
    }
    finally {
      setLoading(false)
    }
  }

  const createFile = async (path: string, content: string = ''): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      await memfs.writeFile(path, content)
      updateFileSystemState()
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create file'
      setError(errorMessage)
      throw err
    }
    finally {
      setLoading(false)
    }
  }

  const readFile = async (path: string): Promise<string> => {
    setError(null)
    try {
      return await memfs.readFile(path)
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read file'
      setError(errorMessage)
      throw err
    }
  }

  const writeFile = async (path: string, content: string): Promise<void> => {
    setError(null)
    try {
      await memfs.writeFile(path, content)
      updateFileSystemState()
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to write file'
      setError(errorMessage)
      throw err
    }
  }

  const deleteEntry = async (path: string): Promise<void> => {
    setError(null)
    try {
      const stat = await memfs.stat(path)
      if (stat.isDirectory()) {
        await memfs.rmdir(path, { recursive: true })
      }
      else {
        await memfs.unlink(path)
      }
      updateFileSystemState()
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete entry'
      setError(errorMessage)
      throw err
    }
  }

  const copyEntry = async (sourcePath: string, targetPath: string): Promise<void> => {
    setError(null)
    try {
      await memfs.copyFile(sourcePath, targetPath)
      updateFileSystemState()
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy entry'
      setError(errorMessage)
      throw err
    }
  }

  const moveEntry = async (sourcePath: string, targetPath: string): Promise<void> => {
    setError(null)
    try {
      await memfs.rename(sourcePath, targetPath)
      updateFileSystemState()
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to move entry'
      setError(errorMessage)
      throw err
    }
  }

  const exists = async (path: string): Promise<boolean> => {
    try {
      return await memfs.exists(path)
    }
    catch {
      return false
    }
  }

  const getStats = async (path: string) => {
    try {
      return await memfs.stat(path)
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get stats'
      setError(errorMessage)
      throw err
    }
  }

  const setFileLocked = async (path: string, locked: boolean): Promise<void> => {
    setError(null)
    try {
      await memfs.setLocked(path, locked)
      updateFileSystemState()
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set file lock status'
      setError(errorMessage)
      throw err
    }
  }

  const isFileLocked = async (path: string): Promise<boolean> => {
    try {
      return await memfs.isLocked(path)
    }
    catch {
      return false
    }
  }

  // Event hooks for different change types with specific typing
  const { on: onFileCreated, trigger: triggerFileCreated } = createEventHook<FileCreatedEvent>()
  const { on: onFileModified, trigger: triggerFileModified } = createEventHook<FileModifiedEvent>()
  const { on: onFileDeleted, trigger: triggerFileDeleted } = createEventHook<FileDeletedEvent>()
  const { on: onFileMoved, trigger: triggerFileMoved } = createEventHook<FileMovedEvent>()
  const { on: onFileLocked, trigger: triggerFileLocked } = createEventHook<FileLockedEvent>()
  const { on: onFileUnlocked, trigger: triggerFileUnlocked } = createEventHook<FileUnlockedEvent>()
  const { on: onFileSystemChange, trigger: triggerFileSystemChange } = createEventHook<FileSystemChangeEvent>()

  // Listen to memfs changes and update state using useSubscription for auto cleanup
  useSubscription(
    memfs.changes$.subscribe((event) => {
      if (!event)
        return

      updateFileSystemState()

      // Trigger general change event
      triggerFileSystemChange(event)

      // Trigger specific change type events
      switch (event.type) {
        case 'created':
          triggerFileCreated(event as FileCreatedEvent)
          break
        case 'modified':
          triggerFileModified(event as FileModifiedEvent)
          break
        case 'deleted':
          triggerFileDeleted(event as FileDeletedEvent)
          break
        case 'moved':
          triggerFileMoved(event as FileMovedEvent)
          break
        case 'locked':
          triggerFileLocked(event as FileLockedEvent)
          break
        case 'unlocked':
          triggerFileUnlocked(event as FileUnlockedEvent)
          break
      }
    }),
  )

  const initialize = async (): Promise<void> => {
    updateFileSystemState()
  }

  initialize()

  return {
    // State
    state: readonly(state),
    allFiles,
    isLoading,
    error,

    // File tree helpers
    getChildrenByPath,
    getFilesByPath,
    getDirectoriesByPath,

    // File operations
    createDirectory,
    createFile,
    readFile,
    writeFile,
    deleteEntry,
    copyEntry,
    moveEntry,
    exists,
    getStats,
    setFileLocked,
    isFileLocked,

    // Events - General
    onFileSystemChange,

    // Events - Specific types
    onFileCreated,
    onFileModified,
    onFileDeleted,
    onFileMoved,
    onFileLocked,
    onFileUnlocked,
  }
}

export const useFileSystem = createSharedComposable(_useFileSystem)
