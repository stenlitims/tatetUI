<script setup lang="ts">
import { ref } from 'vue'
import UiInput from '~/components/ui/UiInput.vue'

const withHint = ref('')
const withError = ref('не-пошта')
const disabled = ref('Недоступно для змін')
</script>

<template>
  <div class="w-full max-w-sm space-y-4">
    <UiInput v-model="withHint" label="Псевдонім" hint="Від 3 до 20 символів." />
    <UiInput v-model="withError" label="Пошта" error="Схоже, це не адреса пошти." />
    <UiInput v-model="disabled" label="Тариф" disabled />
  </div>
</template>
