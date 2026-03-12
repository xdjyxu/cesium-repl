import { describe, expect, it } from 'vitest'
import { createLockService } from './lockService'

describe('lockService', () => {
  it('should initialize with empty state', () => {
    const service = createLockService()
    const state = service.getLockState('/test.ts')

    expect(state.path).toBe('/test.ts')
    expect(state.dirty).toBe(false)
    expect(state.pinned).toBe(false)
  })

  it('should set dirty state', () => {
    const service = createLockService()

    service.setDirty('/test.ts', true)
    expect(service.isDirty('/test.ts')).toBe(true)

    service.setDirty('/test.ts', false)
    expect(service.isDirty('/test.ts')).toBe(false)
  })

  it('should set pinned state', () => {
    const service = createLockService()

    service.setPinned('/test.ts', true)
    expect(service.isPinned('/test.ts')).toBe(true)

    service.setPinned('/test.ts', false)
    expect(service.isPinned('/test.ts')).toBe(false)
  })

  it('should handle both dirty and pinned states', () => {
    const service = createLockService()

    service.setDirty('/test.ts', true)
    service.setPinned('/test.ts', true)

    const state = service.getLockState('/test.ts')
    expect(state.dirty).toBe(true)
    expect(state.pinned).toBe(true)
    expect(service.isLocked('/test.ts')).toBe(true)
  })

  it('should emit lock change events', () => {
    const service = createLockService()
    const events: string[] = []

    service.lockChange$.subscribe((event) => {
      events.push(event.type)
    })

    service.setDirty('/test.ts', true)
    service.setDirty('/test.ts', false)
    service.setPinned('/test.ts', true)
    service.setPinned('/test.ts', false)

    expect(events).toEqual(['dirty', 'clean', 'pin', 'unpin'])
  })

  it('should remove lock state', () => {
    const service = createLockService()

    service.setDirty('/test.ts', true)
    service.setPinned('/test.ts', true)

    service.remove('/test.ts')

    const state = service.getLockState('/test.ts')
    expect(state.dirty).toBe(false)
    expect(state.pinned).toBe(false)
  })

  it('should clear all lock states', () => {
    const service = createLockService()

    service.setDirty('/test1.ts', true)
    service.setDirty('/test2.ts', true)

    service.clear()

    expect(service.isDirty('/test1.ts')).toBe(false)
    expect(service.isDirty('/test2.ts')).toBe(false)
  })

  it('should not emit duplicate events', () => {
    const service = createLockService()
    const events: string[] = []

    service.lockChange$.subscribe((event) => {
      events.push(event.type)
    })

    service.setDirty('/test.ts', true)
    service.setDirty('/test.ts', true) // duplicate
    service.setDirty('/test.ts', true) // duplicate

    expect(events).toEqual(['dirty'])
  })
})
