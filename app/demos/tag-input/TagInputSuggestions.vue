<script setup lang="ts">
import { ref } from 'vue'
import UiTagInput from '~/components/ui/UiTagInput.vue'

const tags = ref<string[]>(['Логістика'])

const suggestions = [
  'Логістика', 'Виробництво', 'Роздріб', 'Гуртівня', 'Послуги',
  'IT', 'Будівництво', 'Агро', 'Медицина', 'Освіта',
]
</script>

<template>
  <div class="w-full max-w-md">
    <UiTagInput
      v-model="tags"
      label="Галузі"
      placeholder="Почніть вводити"
      :suggestions="suggestions"
      hint="Список фільтрується, але вільний ввід теж дозволено"
    />
  </div>
</template>
