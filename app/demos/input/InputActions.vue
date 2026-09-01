<script setup lang="ts">
import { ref } from 'vue'
import UiInput from '~/components/ui/UiInput.vue'

const query = ref('tatetUI')
const password = ref('correct-horse-battery')
</script>

<template>
  <div class="w-full max-w-sm space-y-4">
    <UiInput v-model="query" type="search" label="Пошук" placeholder="Назва компонента…" clearable>
      <template #leading>
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </template>
    </UiInput>
    <UiInput
      v-model="password"
      type="password"
      label="Пароль"
      autocomplete="current-password"
      password-toggle
      clearable
    />
  </div>
</template>
