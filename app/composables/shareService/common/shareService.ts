import type { SandcastleShareData, ShareService } from './protocol'
import Pako from 'pako'

/**
 * 分享服务实现
 * 与 Cesium Sandcastle 完全兼容的代码分享功能
 */
export class ShareServiceImpl implements ShareService {
  /**
   * 压缩并编码数据为 Base64 字符串
   * 算法与 Cesium Sandcastle 完全一致:
   * 1. 将数据转为 JSON 数组 [code, html, baseHref?]
   * 2. 移除首尾的 [" 和 "] 以节省空间
   * 3. 使用 Pako DEFLATE 压缩(raw mode, level 9)
   * 4. 转为 Base64 编码
   * 5. 移除末尾的 padding =
   */
  compress(data: SandcastleShareData): string {
    const { code, html, baseHref } = data

    // 构建 JSON 数组: [code, html] 或 [code, html, baseHref]
    const encode = baseHref ? [code, html, baseHref] : [code, html]
    let jsonString = JSON.stringify(encode)

    // 移除首尾的 [" 和 "] (节省 4 字节)
    // 例如: ["code","html"] -> code","html
    jsonString = jsonString.slice(2, jsonString.length - 2)

    // 使用 Pako 进行 DEFLATE 压缩
    const compressedData = Pako.deflate(jsonString, {
      raw: true, // 使用原始 DEFLATE 格式 (无 zlib header)
      level: 9, // 最高压缩级别
    })

    // 转为 Base64 编码
    let base64String = btoa(String.fromCharCode(...compressedData))

    // 移除末尾的 padding
    base64String = base64String.replace(/=+$/, '')

    return base64String
  }

  /**
   * 解压并解码 Base64 字符串
   * 算法与 Cesium Sandcastle 完全一致:
   * 1. 恢复 Base64 padding
   * 2. 解码 Base64 为字节数组
   * 3. 使用 Pako INFLATE 解压
   * 4. 恢复 JSON 格式 (添加 [" 和 "])
   * 5. 解析 JSON 数组
   */
  decompress(base64String: string): SandcastleShareData {
    // 恢复 Base64 padding
    while (base64String.length % 4 !== 0) {
      base64String += '='
    }

    // 解码 Base64 为字节数组
    const binaryString = atob(base64String)
    const dataArray = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      dataArray[i] = binaryString.charCodeAt(i)
    }

    // 使用 Pako 解压
    let jsonString = Pako.inflate(dataArray, {
      raw: true, // 原始 DEFLATE 格式
      to: 'string', // 直接输出字符串
    })

    // 恢复 JSON 格式: 添加 [" 和 "]
    jsonString = `["${jsonString}"]`

    // 解析 JSON
    const json = JSON.parse(jsonString) as [string, string, string?]

    return {
      code: json[0],
      html: json[1],
      baseHref: json[2],
    }
  }

  /**
   * 生成 Cesium Sandcastle 分享链接
   * @param data - 要分享的数据
   * @param baseUrl - Sandcastle 的基础 URL
   * @returns 完整的分享链接
   */
  generateSandcastleUrl(
    data: SandcastleShareData,
    baseUrl: string = 'https://sandcastle.cesium.com/',
  ): string {
    const compressed = this.compress(data)

    // 确保 baseUrl 以 / 结尾
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

    // Sandcastle 使用 #c= 前缀来标识压缩数据
    return `${normalizedBaseUrl}#c=${compressed}`
  }

  /**
   * 从 Cesium Sandcastle URL 中提取压缩数据
   * @param url - Sandcastle URL
   * @returns 提取的压缩字符串,如果 URL 无效则返回 null
   */
  extractFromSandcastleUrl(url: string): string | null {
    try {
      // 支持完整 URL 和纯 hash 两种格式
      // 例如: https://sandcastle.cesium.com/#c=xxx 或 #c=xxx
      const hashIndex = url.indexOf('#c=')
      if (hashIndex === -1) {
        return null
      }

      // 提取 #c= 之后的内容
      return url.substring(hashIndex + 3)
    }
    catch {
      return null
    }
  }
}
