<script setup lang="ts">
import { ref } from 'vue'
import UiStepper from '~/components/ui/UiStepper.vue'

const step = ref(1)
</script>

<template>
  <div class="w-full max-w-xl">
    <UiStepper
      v-model="step"
      :steps="[
        { id: 'site', label: 'Сайт', description: 'Базові поля' },
        { id: 'content', label: 'Контент' },
        { id: 'publish', label: 'Публікація' },
      ]"
    />
    <p class="mt-2 text-xs text-muted">Крок {{ step + 1 }} з 3 — клікайте по кроках або ведіть станом.</p>
  </div>
</template>