<script setup lang="ts">
import type * as monaco from 'monaco-editor'

/**
 * Monaco 编辑器实例组件（仅客户端）
 */
const props = defineProps<{
  /** 当前激活的文件路径 */
  activeFilePath: string | null
}>()

const editorService = useEditorService()
const { saveFile } = useSaveFile()

// Monaco Editor 容器引用
const editorContainerRef = ref<HTMLDivElement>()

// Monaco Editor 实例
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// 初始化 Monaco Editor
onMounted(async () => {
  if (!editorContainerRef.value)
    return

  editor = await editorService.createEditor(editorContainerRef.value)

  // 注册 Ctrl+S / Cmd+S 保存快捷键
  editor.addCommand(
    // KeyMod.CtrlCmd | KeyCode.KeyS
    2048 | 49,
    () => {
      if (props.activeFilePath) {
        saveFile(props.activeFilePath)
      }
    },
  )

  // 如果初始化时已有激活文件，立即设置 model
  if (props.activeFilePath) {
    const model = editorService.getModel(props.activeFilePath)
    if (model) {
      editor.setModel(model)
    }
  }
})

// 监听激活的 tab 变化，切换显示的 model
watch(() => props.activeFilePath, (newPath) => {
  if (!editor || !newPath)
    return

  const model = editorService.getModel(newPath)
  if (model) {
    editor.setModel(model)
  }
})

// 组件卸载时释放编辑器资源
onUnmounted(() => {
  if (editor) {
    editor.dispose()
    editor = null
  }
})
</script>

<template>
  <div ref="editorContainerRef" class="h-full w-full" />
</template>
