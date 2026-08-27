<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Поточна сторінка. Використовуйте через `v-model:page`. */
    page: number
    /** Скільки всього сторінок. */
    totalPages: number
    /** Загальна кількість записів — для тексту «1–20 з 437». */
    totalItems?: number | null
    /** Розмір сторінки. Використовуйте через `v-model:pageSize`. */
    pageSize?: number
    /** Варіанти розміру сторінки. Порожньо — селект не рендериться. */
    pageSizeOptions?: number[]
    /** Скільки сусідніх сторінок показувати навколо активної. */
    siblingCount?: number
    disabled?: boolean
  }>(),
  {
    totalItems: null,
    pageSize: undefined,
    pageSizeOptions: undefined,
    siblingCount: 1,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()

defineSlots<Record<string, never>>()

/**
 * Завжди видно першу й останню сторінку, навколо активної —
 * `siblingCount` сусідів, між блоками — розрив «…».
 */
const visiblePages = computed<(number | 'gap')[]>(() => {
  const total = Math.max(0, props.totalPages)
  const current = props.page
  const span = Math.max(1, props.siblingCount)

  if (total <= span * 2 + 5) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const start = Math.max(2, current - span)
  const end = Math.min(total - 1, current + span)
  const pages: (number | 'gap')[] = [1]
  if (start > 2) pages.push('gap')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('gap')
  pages.push(total)
  return pages
})

const rangeText = computed(() => {
  if (props.totalItems == null) return ''
  if (props.totalItems === 0) return 'Немає записів'
  if (!props.pageSize) return `Всього: ${props.totalItems.toLocaleString('uk')}`
  const start = (props.page - 1) * props.pageSize + 1
  const end = Math.min(props.page * props.pageSize, props.totalItems)
  return `${start}–${end} з ${props.totalItems.toLocaleString('uk')}`
})

function goTo(target: number) {
  const clamped = Math.min(Math.max(1, target), Math.max(1, props.totalPages))
  if (props.disabled || clamped === props.page) return
  emit('update:page', clamped)
}

function onPageSizeChange(event: Event) {
  const value = Number.parseInt((event.target as HTMLSelectElement).value, 10)
  if (Number.isFinite(value)) emit('update:pageSize', value)
}
</script>

<template>
  <div v-if="totalPages > 1 || pageSizeOptions?.length" class="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
    <div class="flex items-center gap-3 text-sm text-muted">
      <span v-if="rangeText">{{ rangeText }}</span>
      <label v-if="pageSizeOptions?.length" class="flex items-center gap-1.5 text-xs">
        <select
          :value="pageSize"
          :disabled="disabled"
          class="h-11 cursor-pointer rounded-control border border-line bg-input pl-2 pr-6 text-xs text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-8"
          @change="onPageSizeChange"
        >
          <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
        на сторінці
      </label>
    </div>

    <nav v-if="totalPages > 1" aria-label="Пагінація" class="flex items-center gap-1">
      <button
        type="button"
        aria-label="Попередня сторінка"
        :disabled="page <= 1 || disabled"
        class="flex h-11 w-11 items-center justify-center rounded-control border border-line text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
        @click="goTo(page - 1)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- Мобільний: тільки «X з Y» -->
      <span class="px-3 text-sm text-muted sm:hidden">{{ page }} з {{ totalPages }}</span>

      <!-- Десктоп: номери -->
      <template v-for="(p, idx) in visiblePages" :key="`${p}-${idx}`">
        <span v-if="p === 'gap'" class="hidden h-8 w-8 items-center justify-center text-xs text-muted sm:flex">…</span>
        <button
          v-else
          type="button"
          :disabled="disabled"
          :aria-current="p === page ? 'page' : undefined"
          class="hidden h-11 min-w-11 items-center justify-center rounded-control px-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed md:h-8 md:min-w-8"
          :class="
            p === page
              ? 'bg-accent-solid text-accent-contrast'
              : 'border border-line text-muted hover:bg-hover hover:text-ink'
          "
          @click="goTo(p as number)"
        >
          {{ p }}
        </button>
      </template>

      <button
        type="button"
        aria-label="Наступна сторінка"
        :disabled="page >= totalPages || disabled"
        class="flex h-11 w-11 items-center justify-center rounded-control border border-line text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
        @click="goTo(page + 1)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </nav>
  </div>
</template>