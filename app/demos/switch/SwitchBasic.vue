<script setup lang="ts">
import { ref } from 'vue'
import UiSwitch from '~/components/ui/UiSwitch.vue'

const notifications = ref(true)
const digest = ref(false)
</script>

<template>
  <div class="w-full max-w-sm space-y-3">
    <label class="flex items-center justify-between gap-4">
      <span class="text-sm text-ink">Сповіщення в браузері</span>
      <UiSwitch v-model="notifications" label="Сповіщення в браузері" />
    </label>
    <label class="flex items-center justify-between gap-4">
      <span class="text-sm text-ink">Щотижневий дайджест</span>
      <UiSwitch v-model="digest" label="Щотижневий дайджест" />
    </label>
    <label class="flex items-center justify-between gap-4 opacity-60">
      <span class="text-sm text-ink">SMS (недоступно на тарифі)</span>
      <UiSwitch :model-value="false" disabled label="SMS" />
    </label>
  </div>
</template>
