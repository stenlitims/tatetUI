<script setup lang="ts">
import { shallowRef } from 'vue'

const plan = shallowRef('team')
const options = [
  { value: 'solo', label: 'Solo', description: 'Для особистих проєктів' },
  { value: 'team', label: 'Team', description: 'Спільна робота до 20 людей' },
  { value: 'enterprise', label: 'Enterprise', description: 'Звʼяжіться з нами', disabled: true },
]
</script>

<template>
  <UiRadioGroup v-model="plan" name="plan" label="Тариф" :options="options" />
  <p class="mt-4 text-sm text-muted">Обрано: {{ plan }}</p>
</template>
