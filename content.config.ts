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

// Enable remote content only if explicitly enabled via environment variable
const enableRemoteContent = process.env.ENABLE_REMOTE_CONTENT === 'true'

export default defineContentConfig({
  collections: {
    examples: defineCollection({
      type: 'data',
      source: [
        // Local examples
        {
          include: '**/sandcastle.yaml',
          cwd: path.resolve('examples'),
        },
        // Remote official Cesium examples (only if enabled)
        ...(enableRemoteContent
          ? [
              {
                repository: 'https://github.com/CesiumGS/cesium',
                include: 'packages/sandcastle/gallery/**/sandcastle.yaml',
                prefix: '/official',
              },
            ]
          : []),
      ],
      schema: exampleSchema,
    }),
    exampleFiles: defineCollection({
      type: 'data',
      source: [
        // Local example files
        {
          include: '**/*.{js,ts,jsx,tsx,html,htm,css}',
          cwd: path.resolve('examples'),
        },
        // Remote official Cesium example files (only if enabled)
        ...(enableRemoteContent
          ? [
              {
                repository: 'https://github.com/CesiumGS/cesium',
                include: 'packages/sandcastle/gallery/**/*.{js,ts,jsx,tsx,html,htm,css}',
                prefix: '/official',
              },
            ]
          : []),
      ],
      schema: exampleFileSchema,
    }),
  },
})
