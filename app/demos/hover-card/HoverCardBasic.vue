<script setup lang="ts">
import { shallowRef } from 'vue'

const open = shallowRef(false)
</script>

<template>
  <p class="text-sm text-muted">
    Автор бібліотеки —
    <UiHoverCard v-model="open" aria-label="Профіль автора">
      <template #trigger="{ triggerAttrs }">
        <a v-bind="triggerAttrs" href="#profile" class="font-medium text-accent underline decoration-dotted underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ігор</a>
      </template>
      <div class="flex gap-3">
        <UiAvatar name="Ігор К." :size="48" />
        <div>
          <p class="font-semibold text-ink">Ігор К.</p>
          <p class="mt-1 text-sm text-muted">Vue-розробник і автор tatetUI.</p>
          <a href="#follow" class="mt-3 inline-block text-sm font-medium text-accent">Підписатися</a>
        </div>
      </div>
    </UiHoverCard>.
  </p>
</template>
