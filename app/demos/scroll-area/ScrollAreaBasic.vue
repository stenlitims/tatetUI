<script setup lang="ts">
const events = Array.from({ length: 12 }, (_, index) => ({
  title: `Подія ${index + 1}`,
  time: `${String(9 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
}))
</script>

<template>
  <UiScrollArea height="16rem" aria-label="Стрічка подій" class="max-w-md border border-line bg-card">
    <ul class="divide-y divide-line">
      <li v-for="event in events" :key="event.title" class="flex items-center justify-between gap-4 px-4 py-3">
        <span class="text-sm text-ink">{{ event.title }}</span>
        <time class="text-xs text-muted">{{ event.time }}</time>
      </li>
    </ul>
  </UiScrollArea>
</template>
