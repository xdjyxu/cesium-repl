/**
 * 获取所有标签及其计数
 * @returns 标签列表，每项包含标签名和出现次数
 */
export function useGalleryLabels() {
  const { data: allExamples } = useAsyncData(
    'gallery:labels',
    () => queryCollection('examples').select('labels').all(),
  )

  const labels = computed(() => {
    const labelMap = new Map<string, number>()

    allExamples.value?.forEach((example) => {
      example.labels?.forEach((label) => {
        labelMap.set(label, (labelMap.get(label) || 0) + 1)
      })
    })

    return Array.from(labelMap.entries())
      .map(([label, count]) => ({ label, count }))
  })

  return labels
}

/**
 * 获取示例列表的组合式函数
 * @param label - 可选的标签过滤器，支持响应式；为空时返回全部
 */
export function useGalleryCollection(label?: MaybeRefOrGetter<string>) {
  const labelRef = toRef(label)

  const { data: allExamples } = useAsyncData(
    'gallery:all',
    () => queryCollection('examples').select('id', 'slug', 'title', 'labels', 'description').all(),
  )

  const examples = computed(() => {
    const selectedLabel = labelRef.value
    if (!selectedLabel) {
      return allExamples.value
    }
    return allExamples.value?.filter(example => example.labels?.includes(selectedLabel))
  })

  return examples
}

/**
 * 获取单个示例的详细信息（合并 examples 元数据 + exampleFiles 源文件）
 *
 * @param exampleId - 示例的 ID（如 'hello-world', 'custom-ui'）
 * @returns 示例数据的响应式引用
 */
export function useGallery(exampleId: MaybeRefOrGetter<string>) {
  const id = toRef(exampleId)

  const { data } = useAsyncData(
    () => `example:${id.value}`,
    async () => {
      const [example, files] = await Promise.all([
        queryCollection('examples').where('slug', '=', id.value).first(),
        queryCollection('exampleFiles').where('exampleSlug', '=', id.value).all(),
      ])
      if (!example) return null
      return {
        ...example,
        files: files.map(({ path, content, language }) => ({ path, content, language })),
      }
    },
  )

  return data
}
