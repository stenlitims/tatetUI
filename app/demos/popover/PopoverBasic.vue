<script setup lang="ts">
import { shallowRef } from 'vue'

const open = shallowRef(false)
const notifications = shallowRef(true)
</script>

<template>
  <UiPopover v-model="open" width="18rem" aria-label="Швидкі налаштування">
    <template #trigger="{ triggerAttrs }">
      <UiButton v-bind="triggerAttrs" variant="outline">Налаштування</UiButton>
    </template>
    <template #default="{ close }">
      <div class="space-y-4">
        <div>
          <p class="font-semibold text-ink">Швидкі налаштування</p>
          <p class="mt-1 text-sm text-muted">Зміни застосовуються одразу.</p>
        </div>
        <UiSwitch v-model="notifications" label="Сповіщення" />
        <UiButton size="sm" class="w-full" @click="close">Готово</UiButton>
      </div>
    </template>
  </UiPopover>
</template>
