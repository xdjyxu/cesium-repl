<script setup lang="ts">
// default export + 条件动态 import：bundle 分割正确，auto-import 不产生命名冲突
// Vue 3 <script setup> 通过 withAsyncContext 在 await 后恢复实例，provide() 仍然有效
const { default: useServices } = import.meta.server
  ? await import('~/composables/useServices.server')
  : await import('~/composables/useServices.client')

useServices()
</script>

<template>
  <WorkspaceLayout />
</template>
