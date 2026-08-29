<script setup lang="ts">
import { ref } from 'vue'
import UiNumberInput from '~/components/ui/UiNumberInput.vue'

const quantity = ref<number | null>(12)
const discount = ref<number | null>(15)
</script>

<template>
  <div class="grid w-full max-w-md gap-4">
    <UiNumberInput
      v-model="quantity"
      label="Кількість"
      :min="1"
      :max="999"
      hint="Стрілки ↑/↓ змінюють на 1, PageUp/PageDown — на 10"
    />
    <UiNumberInput
      v-model="discount"
      label="Знижка"
      unit="%"
      :min="0"
      :max="100"
      :step="5"
      :steppers="false"
    />
    <p class="text-sm text-muted">
      Разом: {{ quantity ?? 0 }} шт., знижка {{ discount ?? 0 }} %
    </p>
  </div>
</template>
