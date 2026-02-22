import path from 'node:path'
import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const exampleSchema = z.object({
  legacyId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  labels: z.array(z.string()),
  thumbnail: z.string().optional(),
  slug: z.string(),
})

// 每个示例的源文件（js/html/css 等）单独作为 collection，支持独立 HMR
const exampleFileSchema = z.object({
  exampleSlug: z.string(), // 所属示例目录名，如 "custom-ui"
  path: z.string(), // 相对路径，如 "/main.js"
  content: z.string(),
  language: z.string().optional(),
})

export default defineContentConfig({
  collections: {
    examples: defineCollection({
      type: 'data',
      source: {
        include: '**/sandcastle.yaml',
        cwd: path.resolve('examples'),
      },
      schema: exampleSchema,
    }),
    exampleFiles: defineCollection({
      type: 'data',
      source: {
        include: '**/*.{js,ts,jsx,tsx,html,htm,css}',
        cwd: path.resolve('examples'),
      },
      schema: exampleFileSchema,
    }),
  },
})
