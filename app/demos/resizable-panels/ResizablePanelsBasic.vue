<script setup lang="ts">
import { shallowRef } from 'vue'

/*
 * Некерований вживання: без v-model. Ширина живе всередині компонента,
 * тягнеться роздільником, і переживе перезавантаження сторінки завдяки
 * storage-key — саме так компонент використовується в реальних shell-ах.
 */
const touched = shallowRef(false)
</script>

<template>
  <div class="h-64 overflow-hidden rounded-overlay border border-line">
    <UiResizablePanels
      :min="25"
      :max="75"
      storage-key="tatet-ui:demo:resizable-panels"
      @change="touched = true"
    >
      <template #start>
        <div class="h-full bg-card p-4">
          <p class="font-semibold text-ink">Навігація</p>
          <p class="mt-2 text-sm text-muted">Перетягніть роздільник або використайте стрілки.</p>
          <p v-if="touched" class="mt-2 text-xs text-accent">Ширина збережена — перезавантажте сторінку.</p>
        </div>
      </template>
      <template #end>
        <div class="h-full bg-subtle p-4">
          <p class="font-semibold text-ink">Робоча область</p>
          <p class="mt-2 text-sm text-muted">Розмір панелей відновиться з localStorage.</p>
        </div>
      </template>
    </UiResizablePanels>
  </div>
</template>