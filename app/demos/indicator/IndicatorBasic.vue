<script setup lang="ts">
import { shallowRef } from 'vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiIndicator from '~/components/ui/UiIndicator.vue'

const unread = shallowRef(3)
</script>

<template>
  <div class="flex flex-wrap items-center gap-8">
    <!-- Число — у назві самої кнопки; значок лише дублює його для ока. -->
    <UiIndicator :count="unread">
      <UiButton
        variant="outline"
        size="icon"
        :label="unread ? `Сповіщення: ${unread} непрочитаних` : 'Сповіщення'"
        @click="unread = 0"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </UiButton>
    </UiIndicator>

    <UiIndicator :count="128" tone="accent">
      <UiButton variant="outline" size="icon" label="Вхідні: 128 нових">
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </UiButton>
    </UiIndicator>

    <UiIndicator dot tone="success" position="bottom-right" circular>
      <UiAvatar name="Олена Бондар" :size="44" />
    </UiIndicator>

    <UiIndicator dot pulse circular>
      <UiAvatar name="Тарас Мельник" :size="44" tone="neutral" />
    </UiIndicator>

    <UiButton variant="soft" size="sm" @click="unread += 1">Нове сповіщення</UiButton>
  </div>
</template>
