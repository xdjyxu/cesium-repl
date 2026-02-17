import { describe, expect, it } from 'vitest'
import { Deferred } from './deferred'

describe('deferred', () => {
  it('should resolve', async () => {
    const deferred = new Deferred<number>()
    expect(deferred.settled).toBe(false)

    deferred.resolve(42)
    expect(deferred.settled).toBe(true)

    const result = await deferred.promise
    expect(result).toBe(42)
  })

  it('should reject', async () => {
    const deferred = new Deferred<number>()
    expect(deferred.settled).toBe(false)

    const error = new Error('test error')
    deferred.reject(error)
    expect(deferred.settled).toBe(true)

    await expect(deferred.promise).rejects.toThrow('test error')
  })

  it('should not resolve twice', async () => {
    const deferred = new Deferred<number>()

    deferred.resolve(42)
    deferred.resolve(100) // 第二次 resolve 应该被忽略

    const result = await deferred.promise
    expect(result).toBe(42)
  })

  it('should not reject after resolve', async () => {
    const deferred = new Deferred<number>()

    deferred.resolve(42)
    deferred.reject(new Error('should be ignored'))

    const result = await deferred.promise
    expect(result).toBe(42)
  })

  it('should work with void type', async () => {
    const deferred = new Deferred<void>()

    deferred.resolve()
    expect(deferred.settled).toBe(true)

    await expect(deferred.promise).resolves.toBeUndefined()
  })

  it('should work with promise-like values', async () => {
    const deferred = new Deferred<number>()

    deferred.resolve(Promise.resolve(42))
    const result = await deferred.promise
    expect(result).toBe(42)
  })
})
