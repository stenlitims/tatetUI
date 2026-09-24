<script setup lang="ts">
import { shallowRef } from 'vue'
import UiProgressRing from '~/components/ui/UiProgressRing.vue'
import UiSlider from '~/components/ui/UiSlider.vue'

const value = shallowRef(68)
</script>

<template>
  <div class="flex w-full max-w-lg flex-col gap-6">
    <div class="flex flex-wrap items-end gap-6">
      <UiProgressRing :model-value="value" :size="96" show-value label="Заповнення профілю" />
      <UiProgressRing :model-value="value" :size="64" show-value tone="success" label="Виконано задач" />
      <UiProgressRing :model-value="92" :size="48" tone="warning" label="Квота сховища" show-value />
      <UiProgressRing :size="32" label="Обробка файлу" />
      <UiProgressRing :model-value="3" :max="5" :size="56" label="Кроки онбордингу">
        <span class="text-xs">3/5</span>
      </UiProgressRing>
    </div>

    <!-- Компактне кільце в рядку: число поруч, а не всередині. -->
    <div class="flex items-center gap-3 rounded-card border border-line bg-card px-4 py-3">
      <UiProgressRing :model-value="value" :size="24" :thickness="3" label="Використано контексту" />
      <span class="text-sm text-ink">Використано контексту</span>
      <span class="ml-auto text-sm tabular-nums text-muted">{{ value }}%</span>
    </div>

    <UiSlider v-model="value" label="Значення" :min="0" :max="100" show-value />
  </div>
</template>
