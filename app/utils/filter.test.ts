import { describe, expect, it } from 'vitest'
import { createFilter } from './filter'

describe('createFilter', () => {
  it('should accept all files when no patterns provided', () => {
    const filter = createFilter()
    expect(filter('file.js')).toBe(true)
    expect(filter('file.ts')).toBe(true)
    expect(filter('node_modules/lib.js')).toBe(true)
  })

  it('should filter by RegExp include pattern', () => {
    const filter = createFilter(/\.tsx?$/)
    expect(filter('file.ts')).toBe(true)
    expect(filter('file.tsx')).toBe(true)
    expect(filter('file.js')).toBe(false)
  })

  it('should filter by string include pattern', () => {
    const filter = createFilter('*.ts')
    expect(filter('file.ts')).toBe(true)
    expect(filter('test.ts')).toBe(true)
    expect(filter('file.js')).toBe(false)
  })

  it('should filter by multiple include patterns', () => {
    const filter = createFilter([/\.tsx?$/, /\.jsx?$/])
    expect(filter('file.ts')).toBe(true)
    expect(filter('file.js')).toBe(true)
    expect(filter('file.css')).toBe(false)
  })

  it('should exclude matching files', () => {
    const filter = createFilter(/\.js$/, /node_modules/)
    expect(filter('file.js')).toBe(true)
    expect(filter('node_modules/lib.js')).toBe(false)
  })

  it('should handle mixed string and RegExp patterns', () => {
    const filter = createFilter(
      [/\.[mc]?[jt]sx?$/, '*.html'],
      [/node_modules/, '*.spec.*'],
    )

    // Should include
    expect(filter('file.js')).toBe(true)
    expect(filter('file.ts')).toBe(true)
    expect(filter('file.jsx')).toBe(true)
    expect(filter('file.tsx')).toBe(true)
    expect(filter('index.html')).toBe(true)

    // Should exclude
    expect(filter('node_modules/lib.js')).toBe(false)
    expect(filter('file.spec.ts')).toBe(false)
    expect(filter('style.css')).toBe(false)
  })

  it('should match the actual plugin usage pattern', () => {
    const filter = createFilter(
      [/\.[mc]?[jt]sx?$/],
      [/node_modules/],
    )

    // Should include TypeScript/JavaScript files
    expect(filter('src/index.ts')).toBe(true)
    expect(filter('src/component.tsx')).toBe(true)
    expect(filter('main.js')).toBe(true)
    expect(filter('module.mjs')).toBe(true)

    // Should exclude node_modules
    expect(filter('node_modules/package/index.js')).toBe(false)

    // Should exclude other file types
    expect(filter('style.css')).toBe(false)
    expect(filter('index.html')).toBe(false)
  })
})
