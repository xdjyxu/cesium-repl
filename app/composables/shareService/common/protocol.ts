import type { InjectionKey } from 'vue'

/**
 * Sandcastle 分享数据结构
 * 与 Cesium Sandcastle 兼容
 */
export interface SandcastleShareData {
  /**
   * JavaScript 代码
   */
  code: string

  /**
   * HTML 代码
   */
  html: string

  /**
   * 可选的基础路径
   */
  baseHref?: string
}

/**
 * 分享服务接口
 * 提供与 Cesium Sandcastle 兼容的代码分享功能
 */
export interface ShareService {
  /**
   * 压缩并编码数据为 Base64 字符串
   * @param data - 要压缩的数据
   * @returns Base64 编码的压缩字符串
   */
  compress: (data: SandcastleShareData) => string

  /**
   * 解压并解码 Base64 字符串
   * @param base64String - Base64 编码的压缩字符串
   * @returns 解压后的数据
   */
  decompress: (base64String: string) => SandcastleShareData

  /**
   * 生成 Cesium Sandcastle 分享链接
   * @param data - 要分享的数据
   * @param baseUrl - Sandcastle 的基础 URL (默认: https://sandcastle.cesium.com/)
   * @returns 完整的分享链接
   */
  generateSandcastleUrl: (data: SandcastleShareData, baseUrl?: string) => string

  /**
   * 从 Cesium Sandcastle URL 中提取压缩数据
   * @param url - Sandcastle URL
   * @returns 提取的压缩字符串,如果 URL 无效则返回 null
   */
  extractFromSandcastleUrl: (url: string) => string | null
}

// eslint-disable-next-line ts/no-redeclare
export const ShareService = Symbol('ShareService') as InjectionKey<ShareService>
