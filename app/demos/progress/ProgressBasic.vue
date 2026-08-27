<script setup lang="ts">
import { ref } from 'vue'
import UiProgress from '~/components/ui/UiProgress.vue'

const value = ref(64)
</script>

<template>
  <div class="flex max-w-sm flex-col gap-4">
    <UiProgress :model-value="value" show-value label="Завантаження файлів" />
    <UiProgress :model-value="value" size="md" />
    <UiProgress label="Обробка запиту…" />
    <p class="text-xs text-muted">Значення: {{ value }} — рухайте повзунком нижче.</p>
    <input v-model.number="value" type="range" min="0" max="100" class="max-w-sm" />
  </div>
</template>