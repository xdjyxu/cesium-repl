<script setup lang="ts">
/**
 * Gallery 面板
 * 展示示例代码库
 */

const router = useRouter()

const selectedLabel = ref('')
const labels = useGalleryLabels()
const examples = useGalleryCollection(selectedLabel)

function selectExample(slug: string) {
  router.push({ query: { id: slug } })
}
</script>

<template>
  <div class="h-full w-full flex flex-col bg-gray-900">
    <!-- 工具栏 -->
    <div class="h-10 flex items-center gap-2 border-b border-gray-700 bg-gray-800 px-4">
      <input
        type="text"
        placeholder="Search examples..."
        class="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
      >
      <select
        v-model="selectedLabel"
        class="shrink-0 border border-gray-600 rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 outline-none focus:border-blue-500"
      >
        <option value="">
          All
        </option>
        <option
          v-for="item in labels"
          :key="item.label"
          :value="item.label"
        >
          {{ item.label }} ({{ item.count }})
        </option>
      </select>
    </div>

    <!-- Gallery 内容 -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="grid grid-cols-1 gap-4">
        <div
          v-for="example in examples"
          :key="example.id"
          class="cursor-pointer border border-gray-700 rounded bg-gray-800 p-4 transition-colors hover:border-blue-500"
          @click="selectExample(example.slug)"
        >
          <h3 class="mb-1 text-sm text-gray-200 font-semibold">
            {{ example.title }}
          </h3>
          <p
            v-if="example.description"
            class="mb-2 text-xs text-gray-400"
          >
            {{ example.description }}
          </p>
          <div
            v-if="example.labels?.length"
            class="flex flex-wrap gap-1"
          >
            <span
              v-for="label in example.labels"
              :key="label"
              class="border border-gray-600 rounded px-1.5 py-0.5 text-gray-400"
              style="font-size: 10px"
            >
              {{ label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
