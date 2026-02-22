import { basename, dirname, extname } from 'node:path'
import { defineTransformer } from '@nuxt/content'

const languageMap: Record<string, string> = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.json': 'json',
}

export default defineTransformer({
  name: 'example-file',
  extensions: ['.js', '.ts', '.jsx', '.tsx', '.html', '.htm', '.css'],
  // 为 Nuxt Content 不原生支持的文件类型提供解析器（否则抛出 "not supported"）
  parse(file) {
    return { ...file, body: String(file.body ?? '') }
  },
  transform(file) {
    // 只处理来自 exampleFiles collection 的文件
    if (!String(file.id).startsWith('exampleFiles/')) {
      return file
    }
    const ext = extname(String(file.id))
    return {
      ...file,
      exampleSlug: basename(dirname(String(file.id))),
      path: `/${basename(String(file.id))}`,
      content: String(file.body),
      language: languageMap[ext] || ext.slice(1),
    }
  },
})
