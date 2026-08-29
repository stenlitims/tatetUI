<script setup lang="ts">
import { ref } from 'vue'
import UiCalendar from '~/components/ui/UiCalendar.vue'

// Дата фіксована, щоб демо виглядало однаково в прередері й у браузері.
const TODAY = new Date(2026, 7, 17)
const picked = ref<Date | null>(new Date(2026, 7, 17))

const formatted = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long' })
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="rounded-card border border-line bg-card p-3">
      <UiCalendar
        v-model="picked"
        :today="TODAY"
        :min="new Date(2026, 6, 1)"
        :max="new Date(2026, 8, 30)"
        show-week-numbers
        aria-label="Дата візиту"
      />
    </div>
    <p class="text-sm text-muted">
      Обрано: <span class="text-ink">{{ picked ? formatted.format(picked) : 'нічого' }}</span>
    </p>
  </div>
</template>
