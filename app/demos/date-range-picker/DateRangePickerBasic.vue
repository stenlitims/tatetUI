<script setup lang="ts">
import { ref } from 'vue'
import UiDateRangePicker, { type DateRange } from '~/components/ui/UiDateRangePicker.vue'

const TODAY = new Date(2026, 7, 17)
const period = ref<DateRange | null>({ start: new Date(2026, 7, 1), end: new Date(2026, 7, 17) })
const lastPreset = ref('—')

const formatted = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' })
</script>

<template>
  <div class="w-full max-w-sm space-y-3">
    <UiDateRangePicker
      v-model="period"
      :today="TODAY"
      label="Період звіту"
      hint="Пресети ліворуч, а на телефоні — смугою над сіткою"
      @preset-select="lastPreset = $event.label"
    />

    <dl class="space-y-1 text-sm">
      <div class="flex justify-between gap-4">
        <dt class="text-muted">Обрано</dt>
        <dd class="text-ink">
          {{ period ? `${formatted.format(period.start)} — ${formatted.format(period.end)}` : 'нічого' }}
        </dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-muted">Останній пресет</dt>
        <dd class="text-ink">{{ lastPreset }}</dd>
      </div>
    </dl>
  </div>
</template>
