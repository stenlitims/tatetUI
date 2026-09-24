<script setup lang="ts">
import { ref } from 'vue'
import UiStepper from '~/components/ui/UiStepper.vue'

const step = ref(2)
</script>

<template>
  <div class="w-full max-w-sm">
    <UiStepper
      v-model="step"
      orientation="vertical"
      aria-label="Кроки імпорту"
      :steps="[
        { id: 'file', label: 'Файл', description: 'products.csv' },
        { id: 'mapping', label: 'Відповідність полів', description: '2 поля без пари', status: 'error' },
        { id: 'preview', label: 'Перегляд', description: '1 240 рядків' },
        { id: 'import', label: 'Імпорт' },
      ]"
    />
  </div>
</template>
