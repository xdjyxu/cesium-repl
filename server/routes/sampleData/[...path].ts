/**
 * Cesium 示例数据代理
 *
 * 将 /sampleData/** 请求代理到 Cesium GitHub raw（Apps/SampleData 目录）。
 * 开发环境由 Vite proxy 处理（nuxt.config.ts），生产环境由此 Nitro 路由处理。
 *
 * 请求: /sampleData/models/CesiumAir/Cesium_Air.glb
 * 上游: https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumAir/Cesium_Air.glb
 */
export default defineEventHandler(async (event) => {
  const upstreamPath = event.path.replace(/^\/sampleData/, '')
  const upstreamUrl = `https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData${upstreamPath}`

  // 透传查询参数
  const qs = getQuery(event)
  const search = new URLSearchParams()
  for (const [key, val] of Object.entries(qs)) {
    if (val !== undefined && val !== null) {
      search.append(key, String(val))
    }
  }
  const searchStr = search.toString()
  const fullUrl = searchStr ? `${upstreamUrl}?${searchStr}` : upstreamUrl

  const resp = await fetch(fullUrl, {
    headers: {
      // 透传 Accept / Accept-Encoding，确保上游返回正确格式
      accept: getHeader(event, 'accept') ?? '*/*',
      'accept-encoding': getHeader(event, 'accept-encoding') ?? 'gzip, deflate, br',
    },
  })

  if (!resp.ok) {
    setResponseStatus(event, resp.status)
    return `Upstream returned ${resp.status}`
  }

  // 转发响应头（跳过 transfer-encoding，Nitro 会自行设置）
  const skipHeaders = new Set(['transfer-encoding', 'content-encoding'])
  resp.headers.forEach((value, key) => {
    if (!skipHeaders.has(key.toLowerCase())) {
      setResponseHeader(event, key, value)
    }
  })

  setResponseStatus(event, resp.status)

  // 对二进制资源（.glb 等）设置强缓存
  if (/\.(?:glb|gltf|bin|png|jpe?g|gif|webp|svg|ico)$/i.test(upstreamPath)) {
    setResponseHeader(event, 'cache-control', 'public, max-age=2592000, immutable')
  }

  // 返回 ReadableStream，由 Nitro 负责流式传输
  return resp.body
})
