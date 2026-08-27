<script setup lang="ts">
import { ref } from 'vue'
import UiFileUpload from '~/components/ui/UiFileUpload.vue'

const log = ref<string[]>([])

function onSelect(files: File[]) {
  log.value.unshift(`select: ${files.map((f) => f.name).join(', ')}`)
}

function onError(message: string) {
  log.value.unshift(`error: ${message}`)
}
</script>

<template>
  <div class="max-w-md">
    <UiFileUpload
      accept="image/*,.pdf"
      hint="Зображення або PDF, до 10 МБ. Завантаження на сервер — на боці споживача."
      @select="onSelect"
      @error="onError"
    />
    <ul v-if="log.length" class="mt-3 space-y-1 text-xs text-muted">
      <li v-for="(entry, index) in log.slice(0, 4)" :key="index">{{ entry }}</li>
    </ul>
  </div>
</template>