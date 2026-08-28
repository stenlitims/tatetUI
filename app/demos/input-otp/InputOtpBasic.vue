<script setup lang="ts">
import { shallowRef } from 'vue'

const code = shallowRef('')
const completed = shallowRef('')
</script>

<template>
  <UiInputOtp
    v-model="code"
    name="verification_code"
    label="Код підтвердження"
    hint="Введіть або вставте 6 цифр із повідомлення."
    @complete="completed = $event"
  />
  <p class="mt-4 text-sm text-muted">{{ completed ? `Код ${completed} готовий` : `${code.length}/6` }}</p>
</template>
