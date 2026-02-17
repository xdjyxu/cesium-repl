import path from 'node:path'
import { defineCollection, defineContentConfig, z } from '@nuxt/content'

// 示例文件的 schema
const exampleFileSchema = z.object({
  path: z.string(), // 相对路径，如 'main.js', 'index.html'
  content: z.string(), // 文件内容
  language: z.string().optional(), // 语言类型
})

// 示例的 schema（对齐 Cesium Sandcastle 格式）
const exampleSchema = z.object({
  legacyId: z.string().optional(), // 旧的示例 ID
  title: z.string(),
  description: z.string(),
  labels: z.array(z.string()), // 标签列表（替代 category）
  thumbnail: z.string().optional(), // 缩略图
  files: z.array(exampleFileSchema), // 所有文件
  slug: z.string(), // URL slug，如 "custom-ui"
})

export default defineContentConfig({
  collections: {
    // 自定义的示例 collection
    examples: defineCollection({
      type: 'data',
      source: {
        include: '**/sandcastle.yaml',
        cwd: path.resolve('examples'),
      },
      schema: exampleSchema,
    }),
  },
})
