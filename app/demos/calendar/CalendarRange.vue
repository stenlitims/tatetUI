<script setup lang="ts">
import { ref } from 'vue'
import UiCalendar from '~/components/ui/UiCalendar.vue'

const TODAY = new Date(2026, 7, 17)
const range = ref<[Date, Date] | null>([new Date(2026, 7, 10), new Date(2026, 7, 19)])

// Вихідні недоступні: predicate лишає день фокусованим, але не обираним.
function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6
}

const formatted = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' })
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="rounded-card border border-line bg-card p-3">
      <UiCalendar
        v-model="range"
        mode="range"
        :months="2"
        :today="TODAY"
        :disabled-date="isWeekend"
        aria-label="Період бронювання"
      />
    </div>
    <p class="text-sm text-muted">
      Період:
      <span class="text-ink">
        {{ range ? `${formatted.format(range[0])} — ${formatted.format(range[1])}` : 'не обрано' }}
      </span>
    </p>
  </div>
</template>
