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
    <UiProgress :model-value="92" tone="warning" label="Квота сховища" show-value />
    <UiProgress :model-value="100" tone="success" label="Резервну копію створено" show-value />
    <p class="text-xs text-muted">Значення: {{ value }} — рухайте повзунком нижче.</p>
    <input v-model.number="value" type="range" min="0" max="100" class="max-w-sm" />
  </div>
</template>