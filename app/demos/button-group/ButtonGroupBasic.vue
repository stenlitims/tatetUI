<script setup lang="ts">
import { shallowRef } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiButtonGroup from '~/components/ui/UiButtonGroup.vue'

const zoom = shallowRef(100)
const bold = shallowRef(true)
const italic = shallowRef(false)
</script>

<template>
  <div class="flex w-full max-w-lg flex-col items-start gap-6">
    <!-- Стан кнопки-перемикача — aria-pressed, а не лише колір заливки. -->
    <UiButtonGroup label="Форматування тексту">
      <UiButton :variant="bold ? 'soft' : 'outline'" size="icon" label="Жирний" :aria-pressed="bold" @click="bold = !bold">
        <span class="text-sm font-bold" aria-hidden="true">Ж</span>
      </UiButton>
      <UiButton :variant="italic ? 'soft' : 'outline'" size="icon" label="Курсив" :aria-pressed="italic" @click="italic = !italic">
        <span class="text-sm italic" aria-hidden="true">К</span>
      </UiButton>
      <UiButton variant="outline" size="icon" label="Посилання">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
        </svg>
      </UiButton>
    </UiButtonGroup>

    <UiButtonGroup label="Масштаб">
      <UiButton variant="outline" size="sm" label="Зменшити" :disabled="zoom <= 50" @click="zoom -= 25">−</UiButton>
      <UiButton variant="outline" size="sm" class="min-w-16 justify-center tabular-nums" @click="zoom = 100">{{ zoom }}%</UiButton>
      <UiButton variant="outline" size="sm" label="Збільшити" :disabled="zoom >= 200" @click="zoom += 25">+</UiButton>
    </UiButtonGroup>

    <UiButtonGroup label="Дії з файлом" block>
      <UiButton variant="outline">Завантажити</UiButton>
      <UiButton variant="outline">Поділитися</UiButton>
      <UiButton variant="outline">Перейменувати</UiButton>
    </UiButtonGroup>
  </div>
</template>
