<script setup lang="ts">
/**
 * 可调整大小的分栏组件
 * 支持水平和垂直方向的拖拽分割
 */
interface Props {
  /**
   * 分割方向
   */
  direction?: 'horizontal' | 'vertical'

  /**
   * 初始分割比例 (0-1)
   */
  initialRatio?: number

  /**
   * 最小面板大小（像素）
   */
  minSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'horizontal',
  initialRatio: 0.5,
  minSize: 100,
})

const isDragging = ref(false)
const ratio = ref(props.initialRatio)
const containerRef = ref<HTMLElement>()

function startDrag() {
  isDragging.value = true
  document.body.style.cursor = props.direction === 'horizontal' ? 'ew-resize' : 'ns-resize'
  document.body.style.userSelect = 'none'
}

function stopDrag() {
  isDragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function handleDrag(event: MouseEvent) {
  if (!isDragging.value || !containerRef.value)
    return

  const rect = containerRef.value.getBoundingClientRect()

  if (props.direction === 'horizontal') {
    const x = event.clientX - rect.left
    const newRatio = Math.max(
      props.minSize / rect.width,
      Math.min((rect.width - props.minSize) / rect.width, x / rect.width),
    )
    ratio.value = newRatio
  }
  else {
    const y = event.clientY - rect.top
    const newRatio = Math.max(
      props.minSize / rect.height,
      Math.min((rect.height - props.minSize) / rect.height, y / rect.height),
    )
    ratio.value = newRatio
  }
}

onMounted(() => {
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
})

const containerClass = computed(() => {
  return props.direction === 'horizontal' ? 'flex-row' : 'flex-col'
})

const firstPaneStyle = computed(() => {
  const size = `${ratio.value * 100}%`
  return props.direction === 'horizontal'
    ? { width: size }
    : { height: size }
})

const dividerClass = computed(() => {
  return props.direction === 'horizontal'
    ? 'w-1 cursor-ew-resize hover:bg-blue-600'
    : 'h-1 cursor-ns-resize hover:bg-blue-600'
})
</script>

<template>
  <div ref="containerRef" class="h-full w-full flex" :class="containerClass">
    <div class="overflow-hidden" :style="firstPaneStyle">
      <slot name="first" />
    </div>

    <div
      class="bg-gray-200 transition-colors dark:bg-gray-700"
      :class="[dividerClass, { 'bg-blue-600': isDragging }]"
      @mousedown="startDrag"
    />

    <div class="flex-1 overflow-hidden">
      <slot name="second" />
    </div>
  </div>
</template>
