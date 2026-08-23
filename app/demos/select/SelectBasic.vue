<script setup lang="ts">
import { ref } from 'vue'
import UiSelect, { type SelectOption } from '~/components/ui/UiSelect.vue'

const country = ref<string | number | null>('ua')

const options: SelectOption[] = [
  { value: 'ua', label: 'Україна' },
  { value: 'pl', label: 'Польща' },
  { value: 'de', label: 'Німеччина' },
  { value: 'cz', label: 'Чехія' },
  { value: 'sk', label: 'Словаччина' },
  { value: 'ru', label: 'Недоступно', disabled: true },
]
</script>

<template>
  <div class="w-full max-w-sm">
    <UiSelect
      v-model="country"
      :options="options"
      label="Країна"
      placeholder="Оберіть країну"
      clearable
      hint="Список звужується під час набору."
    />
  </div>
</template>
