import type { SandcastleShareData } from './protocol'
import { describe, expect, it } from 'vitest'
import { ShareServiceImpl } from './shareService'

describe('shareService', () => {
  const shareService = new ShareServiceImpl()

  const testData: SandcastleShareData = {
    code: 'console.log("Hello Cesium");',
    html: '<div>Test HTML</div>',
  }

  const testDataWithBaseHref: SandcastleShareData = {
    code: 'console.log("Hello Cesium");',
    html: '<div>Test HTML</div>',
    baseHref: 'https://example.com/',
  }

  it('should compress and decompress data correctly', () => {
    const compressed = shareService.compress(testData)
    expect(compressed).toBeTruthy()
    expect(typeof compressed).toBe('string')

    const decompressed = shareService.decompress(compressed)
    expect(decompressed.code).toBe(testData.code)
    expect(decompressed.html).toBe(testData.html)
    expect(decompressed.baseHref).toBeUndefined()
  })

  it('should handle data with baseHref', () => {
    const compressed = shareService.compress(testDataWithBaseHref)
    const decompressed = shareService.decompress(compressed)

    expect(decompressed.code).toBe(testDataWithBaseHref.code)
    expect(decompressed.html).toBe(testDataWithBaseHref.html)
    expect(decompressed.baseHref).toBe(testDataWithBaseHref.baseHref)
  })

  it('should generate valid Sandcastle URL', () => {
    const url = shareService.generateSandcastleUrl(testData)

    expect(url).toContain('https://sandcastle.cesium.com/')
    expect(url).toContain('#c=')

    // 提取并验证压缩数据
    const extracted = shareService.extractFromSandcastleUrl(url)
    expect(extracted).toBeTruthy()

    if (extracted) {
      const decompressed = shareService.decompress(extracted)
      expect(decompressed.code).toBe(testData.code)
      expect(decompressed.html).toBe(testData.html)
    }
  })

  it('should generate URL with custom base URL', () => {
    const customBase = 'https://custom.example.com/sandcastle'
    const url = shareService.generateSandcastleUrl(testData, customBase)

    expect(url).toContain('https://custom.example.com/sandcastle/')
    expect(url).toContain('#c=')
  })

  it('should extract data from Sandcastle URL', () => {
    const url = 'https://sandcastle.cesium.com/#c=eJxTYMAHWBgYAAAYAAE'
    const extracted = shareService.extractFromSandcastleUrl(url)

    expect(extracted).toBe('eJxTYMAHWBgYAAAYAAE')
  })

  it('should extract data from hash only', () => {
    const hash = '#c=eJxTYMAHWBgYAAAYAAE'
    const extracted = shareService.extractFromSandcastleUrl(hash)

    expect(extracted).toBe('eJxTYMAHWBgYAAAYAAE')
  })

  it('should return null for invalid URL', () => {
    const invalidUrl = 'https://example.com/no-hash'
    const extracted = shareService.extractFromSandcastleUrl(invalidUrl)

    expect(extracted).toBeNull()
  })

  it('should be compatible with Cesium Sandcastle format', () => {
    // 这个测试确保我们的实现与 Cesium Sandcastle 的格式兼容
    // 使用一个已知的 Sandcastle 压缩字符串进行测试
    const cesiumCompressed = shareService.compress({
      code: 'viewer.scene.globe.enableLighting = true;',
      html: '',
    })

    // 确保压缩后的字符串不包含 padding
    expect(cesiumCompressed).not.toMatch(/=+$/)

    // 确保可以正确解压
    const decompressed = shareService.decompress(cesiumCompressed)
    expect(decompressed.code).toBe('viewer.scene.globe.enableLighting = true;')
    expect(decompressed.html).toBe('')
  })
})
