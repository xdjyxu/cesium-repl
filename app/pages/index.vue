<script setup lang="ts">
const { state } = useExampleLoader()
</script>

<template>
  <WorkspaceLayout :fs-loading="state.loading" />
</template>
