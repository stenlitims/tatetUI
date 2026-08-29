<script setup lang="ts">
import UiTimeline, { type TimelineItem } from '~/components/ui/UiTimeline.vue'

const events: TimelineItem[] = [
  { id: 1, title: 'Статус → Оплачено', time: '16:40', tone: 'success' },
  { id: 2, title: 'Рахунок надіслано', time: '15:12', tone: 'accent' },
  { id: 3, title: 'Не вдалося списати кошти', time: '14:58', tone: 'danger' },
  { id: 4, title: 'Замовлення створено', time: '14:30', tone: 'neutral' },
]
</script>

<template>
  <div class="w-full max-w-sm rounded-card border border-line bg-card p-4">
    <!-- Власна іконка замість крапки — через слот `dot`. -->
    <UiTimeline :items="events" density="sm">
      <template #dot="{ item }">
        <span
          aria-hidden="true"
          class="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
          :class="item.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-neutral-bg text-neutral'"
        >{{ item.tone === 'danger' ? '!' : '•' }}</span>
      </template>
    </UiTimeline>
  </div>
</template>
