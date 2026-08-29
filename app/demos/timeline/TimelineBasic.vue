<script setup lang="ts">
import UiTimeline, { type TimelineItem } from '~/components/ui/UiTimeline.vue'

const events: TimelineItem[] = [
  {
    id: 1,
    title: 'Угоду виграно',
    description: 'Підписано договір на ₴420 000, термін — 12 місяців.',
    datetime: '2026-08-17T16:40:00+03:00',
    tone: 'success',
  },
  {
    id: 2,
    title: 'Надіслано комерційну пропозицію',
    description: 'Версія 3 — з урахуванням знижки за річну оплату.',
    datetime: '2026-08-14T11:05:00+03:00',
    tone: 'accent',
  },
  {
    id: 3,
    title: 'Дзвінок, 14 хвилин',
    description: 'Обговорили міграцію даних і терміни впровадження.',
    datetime: '2026-08-12T09:20:00+03:00',
    tone: 'info',
  },
  {
    id: 4,
    title: 'Ліда створено',
    datetime: '2026-08-08T18:02:00+03:00',
    tone: 'neutral',
  },
]
</script>

<template>
  <div class="w-full max-w-lg rounded-card border border-line bg-card p-5">
    <h3 class="mb-4 text-sm font-semibold text-ink">Історія угоди</h3>
    <UiTimeline :items="events" />
  </div>
</template>
