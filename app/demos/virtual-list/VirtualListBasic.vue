<script setup lang="ts">
import UiVirtualList from '~/components/ui/UiVirtualList.vue'

interface Row extends Record<string, unknown> {
  id: number
  label: string
  value: number
}

// 10 000 рядків. Значення детерміновані: (i * 7919) % 1000, а не Math.random()
// — інакше прередер і клієнт показали б різні числа.
const items: Row[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i,
  label: `Рядок №${i + 1}`,
  value: (i * 7919) % 1000,
}))
</script>

<template>
  <UiVirtualList :items="items" :item-height="36" height="16rem">
    <template #item="{ item, index }">
      <div class="flex items-center justify-between gap-3 border-b border-line px-3">
        <span class="min-w-0 truncate text-sm">{{ item.label }}</span>
        <span class="shrink-0 text-xs tabular-nums text-muted">#{{ index }} · {{ item.value }}</span>
      </div>
    </template>
  </UiVirtualList>
</template>