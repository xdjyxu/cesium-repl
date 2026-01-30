<script setup lang="ts">
/**
 * Gallery 面板
 * 展示示例代码库
 */
</script>

<template>
  <div class="h-full w-full flex flex-col bg-gray-900">
    <!-- 搜索栏 -->
    <div class="h-10 flex items-center border-b border-gray-700 bg-gray-800 px-4">
      <input
        type="text"
        placeholder="Search examples..."
        class="w-full bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
      >
    </div>

    <!-- Gallery 内容 -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="grid grid-cols-1 gap-4">
        <!-- 示例卡片占位 -->
        <div
          v-for="i in 6"
          :key="i"
          class="cursor-pointer border border-gray-700 rounded bg-gray-800 p-4 transition-colors hover:border-blue-500"
        >
          <h3 class="mb-2 text-sm text-gray-200 font-semibold">
            Example {{ i }}
          </h3>
          <p class="text-xs text-gray-400">
            Sample description for example {{ i }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
