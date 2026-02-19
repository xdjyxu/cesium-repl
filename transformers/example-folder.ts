import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { defineTransformer } from '@nuxt/content'

// 语言检测映射
const languageMap: Record<string, string> = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
}

export default defineTransformer({
  name: 'example-folder',
  extensions: ['.yaml', '.yml'], // 处理 YAML 文件
  async transform(file) {
    // 只处理 sandcastle.yaml 文件
    if (!file.id.endsWith('sandcastle.yaml')) {
      return file
    }

    try {
      // 获取示例文件夹路径
      const galleryDir = dirname(file.id)

      // 读取文件夹中的所有文件
      const entries = await readdir(galleryDir, { withFileTypes: true })

      // 读取所有文件内容（排除 sandcastle.yaml）
      const files = await Promise.all(
        entries
          .filter(entry => entry.isFile() && entry.name !== 'sandcastle.yaml')
          .map(async (entry) => {
            const filePath = join(galleryDir, entry.name)
            const fileContent = await readFile(filePath, 'utf-8')
            const ext = extname(entry.name)
            const language = languageMap[ext] || ext.slice(1)

            return {
              path: `/${entry.name}`,
              content: fileContent,
              language,
            }
          }),
      )

      // 合并 meta 数据和文件内容
      return {
        ...file,
        files,
        slug: basename(galleryDir), // 添加 slug 字段，例如 "custom-ui"
      }
    }
    catch (error) {
      console.error(`Error processing example at ${file._id}:`, error)
      return file
    }
  },
})
