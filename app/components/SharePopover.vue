<script setup lang="ts">
const { getCompressed } = useShareData()

const isOpen = ref(false)
const shareUrl = ref('')
const wasCopied = ref(false)
const buttonRef = ref<HTMLButtonElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

let copyTimeout: ReturnType<typeof setTimeout> | null = null

function openPopover() {
  const compressed = getCompressed()
  if (!compressed)
    return

  shareUrl.value = `${window.location.origin}${window.location.pathname}#c=${compressed}`

  const rect = buttonRef.value?.getBoundingClientRect()
  if (rect) {
    popoverStyle.value = {
      top: `${rect.bottom + 4}px`,
      right: `${window.innerWidth - rect.right}px`,
    }
  }

  isOpen.value = true
  wasCopied.value = false
}

watch(isOpen, async (val) => {
  if (val) {
    await nextTick()
    textareaRef.value?.select()
  }
})

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    wasCopied.value = true
    if (copyTimeout)
      clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      wasCopied.value = false
    }, 2000)
  }
  catch (error) {
    if (error instanceof DOMException) {
      console.error('Clipboard access denied outside of a secure context')
    }
    else {
      throw error
    }
  }
}

onUnmounted(() => {
  if (copyTimeout)
    clearTimeout(copyTimeout)
})
</script>

<template>
  <div>
    <button
      ref="buttonRef"
      class="h-7 rounded bg-gray-100 px-3 text-sm text-gray-500 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:text-gray-400 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      title="Share"
      @click="openPopover"
    >
      Share
    </button>

    <Teleport to="body">
      <!-- Backdrop: closes popover on click outside -->
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40"
        @click="isOpen = false"
      />

      <!-- Popover panel -->
      <div
        v-if="isOpen"
        class="fixed z-50 w-96 border border-gray-300 rounded-lg bg-gray-100 p-4 shadow-xl dark:border-gray-600 dark:bg-gray-800"
        :style="popoverStyle"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm text-gray-800 font-semibold dark:text-gray-200">Share</span>
          <button
            class="h-6 w-6 flex items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            @click="isOpen = false"
          >
            <div class="i-carbon-close text-sm" />
          </button>
        </div>

        <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Copy this link to share the current state. Re-share after any changes.
        </p>

        <div class="flex items-start gap-2">
          <textarea
            ref="textareaRef"
            :value="shareUrl"
            readonly
            rows="3"
            class="flex-1 resize-none border border-gray-300 rounded bg-gray-200 px-3 py-2 text-xs text-gray-800 font-mono outline-none dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
          <button
            class="mt-0.5 h-8 w-8 flex shrink-0 items-center justify-center rounded transition-colors"
            :class="wasCopied ? 'bg-green-700 text-green-200' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'"
            :title="wasCopied ? 'Copied!' : 'Copy to clipboard'"
            @click="copyToClipboard"
          >
            <div :class="wasCopied ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
