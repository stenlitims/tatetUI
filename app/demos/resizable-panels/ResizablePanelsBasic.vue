<script setup lang="ts">
import { shallowRef } from 'vue'

const size = shallowRef(42)
</script>

<template>
  <div class="h-64 overflow-hidden rounded-overlay border border-line">
    <UiResizablePanels v-model="size" :min="25" :max="75">
      <template #start>
        <div class="h-full bg-card p-4">
          <p class="font-semibold text-ink">Навігація</p>
          <p class="mt-2 text-sm text-muted">{{ Math.round(size) }}% ширини</p>
        </div>
      </template>
      <template #end>
        <div class="h-full bg-subtle p-4">
          <p class="font-semibold text-ink">Робоча область</p>
          <p class="mt-2 text-sm text-muted">Перетягніть роздільник або використайте стрілки.</p>
        </div>
      </template>
    </UiResizablePanels>
  </div>
</template>
