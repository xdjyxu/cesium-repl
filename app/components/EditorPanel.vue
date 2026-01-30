<script setup lang="ts">
/**
 * 编辑器面板
 * 集成 Monaco Editor
 */
</script>

<template>
  <div class="h-full w-full flex flex-col bg-gray-900">
    <!-- 文件标签栏 -->
    <div class="h-10 flex items-center border-b border-gray-700 bg-gray-800 px-2">
      <div class="rounded bg-gray-700 px-3 py-1 text-sm text-gray-200">
        main.ts
      </div>
    </div>

    <!-- Monaco Editor 容器 -->
    <div class="flex-1 bg-gray-900">
      <div class="h-full w-full flex items-center justify-center text-gray-500">
        Monaco Editor will be integrated here
      </div>
    </div>
  </div>
</template>
