<script setup lang="ts">
import { ref } from 'vue'
import UiDatePicker from '~/components/ui/UiDatePicker.vue'

const date = ref('2026-08-27')
</script>

<template>
  <div class="w-full max-w-sm">
    <UiDatePicker v-model="date" label="Дата публікації" />
  </div>
</template>