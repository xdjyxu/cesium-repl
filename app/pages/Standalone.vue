<script setup lang="ts">
/**
 * Standalone 页面 — 与 Cesium Sandcastle standalone.html 等价
 *
 * 从 URL hash `/#c=<compressed>` 中提取分享的代码，解压后直接在
 * Cesium + Sandcastle 环境中执行，无需 iframe transport 或编辑器。
 *
 * 兼容标准 Sandcastle 分享链接格式:
 *   https://sandcastle.cesium.com/#c=<compressed>
 *   http://localhost:3000/standalone#c=<compressed>
 */

import { useShareService } from '~/composables/shareService/common/useShareService'

// 禁用布局
definePageMeta({
  layout: false,
})

useHead({
  title: 'Cesium Demo',
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no' },
  ],
  link: [
    {
      rel: 'stylesheet',
      href: 'https://cdn.jsdelivr.net/npm/cesium@1.137.0/Build/Cesium/Widgets/widgets.css',
    },
  ],
})

// #region Execution setup

const shareService = useShareService()
const { isLoadingOverlayVisible, executeOrQueue } = useCesiumSandbox()

onMounted(() => {
  const hash = window.location.hash
  if (!hash.startsWith('#c='))
    return

  const compressed = hash.slice(3)

  let data
  try {
    data = shareService.decompress(compressed)
  }
  catch (err) {
    console.error('Failed to decompress share data:', err)
    return
  }

  executeOrQueue(data)
})

// #endregion
</script>

<template>
  <div id="cesiumContainer" />

  <div
    v-show="isLoadingOverlayVisible"
    id="loadingOverlay"
  >
    <h1>Loading...</h1>
  </div>

  <div id="toolbar" />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
  position: relative;
}

#loadingOverlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

#loadingOverlay h1 {
  color: white;
  font-size: 1.5rem;
  font-family: sans-serif;
}

/* Toolbar */
#toolbar {
  position: absolute;
  top: 0;
  left: 0;
  margin: 5px;
  padding: 8px;
  background: #2a2d35;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: calc(100% - 130px);
  overflow-y: auto;
  z-index: 40;
}

#toolbar:empty {
  display: none;
}

/* Button */
.stratakit-mimic-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  min-height: 1.5rem;
  background: #3d4049;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  font-weight: 500;
  font-family: sans-serif;
  cursor: pointer;
  user-select: none;
  transition: background 150ms ease-out;
}

.stratakit-mimic-button:hover {
  background: #4a4e5a;
}

.stratakit-mimic-button:active {
  background: #555a68;
}

/* Toggle field */
.stratakit-mimic-field {
  display: inline-grid;
  grid-template-columns: auto auto;
  gap: 6px;
  align-items: center;
  cursor: pointer;
}

/* Switch (pill toggle) */
.stratakit-mimic-switch {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  display: inline-block;
  width: 2rem;
  height: 1.125rem;
  background: #555a68;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 150ms ease-out,
    border-color 150ms ease-out;
}

.stratakit-mimic-switch::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 2px;
  transform: translateY(-50%);
  width: 0.75rem;
  height: 0.75rem;
  background: white;
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: transform 150ms ease-out;
}

.stratakit-mimic-switch:checked {
  background: #4a90d9;
  border-color: #4a90d9;
}

.stratakit-mimic-switch:checked::after {
  transform: translateY(-50%) translateX(0.875rem);
}

/* Label */
.stratakit-mimic-label {
  color: #c0c4cc;
  font-size: 12px;
  font-family: sans-serif;
  cursor: pointer;
  user-select: none;
}

/* Select wrapper */
.stratakit-mimic-select-root {
  display: inline-grid;
  align-items: center;
}

select.stratakit-mimic-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 1.5rem;
  cursor: pointer;
}
</style>
