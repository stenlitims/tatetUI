<script setup lang="ts">
import { computed } from 'vue'
import { computeVisiblePages } from '~/utils/pagination'

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

const normalizedTotalPages = computed(() =>
  Number.isFinite(props.totalPages) ? Math.max(1, Math.floor(props.totalPages)) : 1,
)
const normalizedPage = computed(() =>
  Math.min(
    normalizedTotalPages.value,
    Number.isFinite(props.page) ? Math.max(1, Math.floor(props.page)) : 1,
  ),
)

/**
 * Завжди видно першу й останню сторінку, навколо активної —
 * `siblingCount` сусідів, між блоками — розрив «…».
 */
const visiblePages = computed<(number | 'gap')[]>(() =>
  computeVisiblePages(normalizedTotalPages.value, normalizedPage.value, props.siblingCount),
)

const rangeText = computed(() => {
  if (props.totalItems == null) return ''
  if (props.totalItems === 0) return 'Немає записів'
  if (!props.pageSize) return `Всього: ${props.totalItems.toLocaleString('uk')}`
  const start = Math.min((normalizedPage.value - 1) * props.pageSize + 1, props.totalItems)
  const end = Math.min(normalizedPage.value * props.pageSize, props.totalItems)
  return `${start}–${end} з ${props.totalItems.toLocaleString('uk')}`
})

function goTo(target: number) {
  const clamped = Math.min(Math.max(1, target), normalizedTotalPages.value)
  if (props.disabled || clamped === normalizedPage.value) return
  emit('update:page', clamped)
}

function onPageSizeChange(event: Event) {
  const value = Number.parseInt((event.target as HTMLSelectElement).value, 10)
  if (Number.isFinite(value)) emit('update:pageSize', value)
}
</script>

<template>
  <div v-if="normalizedTotalPages > 1 || pageSizeOptions?.length" class="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
    <div class="flex items-center gap-3 text-sm text-muted">
      <span v-if="rangeText">{{ rangeText }}</span>
      <label v-if="pageSizeOptions?.length" class="flex items-center gap-1.5 text-xs">
        <select
          :value="pageSize"
          :disabled="disabled"
          class="h-12 cursor-pointer rounded-control border border-line bg-input pl-2 pr-6 text-base text-ink transition-[border-color,box-shadow] not-disabled:hover:border-line-strong focus:outline-none focus-visible:border-accent-solid focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:h-8 md:text-xs"
          @change="onPageSizeChange"
        >
          <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
        на сторінці
      </label>
    </div>

    <nav v-if="normalizedTotalPages > 1" aria-label="Пагінація" class="flex items-center gap-1">
      <!-- Зона дотику 45×45 на дотику — стрілки лишилися компактними. -->
      <button
        type="button"
        aria-label="Попередня сторінка"
        :disabled="normalizedPage <= 1 || disabled"
        class="relative flex h-9 w-9 items-center justify-center rounded-control border border-line text-muted transition-colors hover:border-line-strong hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8 pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-12"
        @click="goTo(normalizedPage - 1)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- Мобільний: тільки «X з Y» -->
      <span class="px-3 text-sm text-muted sm:hidden">
        {{ normalizedPage }} з {{ normalizedTotalPages }}
      </span>

      <!-- Десктоп: номери -->
      <template v-for="(p, idx) in visiblePages" :key="`${p}-${idx}`">
        <span v-if="p === 'gap'" class="hidden h-8 w-8 items-center justify-center text-xs text-muted sm:flex">…</span>
        <button
          v-else
          type="button"
          :disabled="disabled"
          :aria-current="p === normalizedPage ? 'page' : undefined"
          class="hidden h-9 min-w-9 items-center justify-center rounded-control px-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed sm:flex md:h-8 md:min-w-8"
          :class="
            p === normalizedPage
              ? 'bg-accent-solid text-accent-contrast shadow-card'
              : 'border border-line text-muted hover:border-line-strong hover:bg-hover hover:text-ink'
          "
          @click="goTo(p as number)"
        >
          {{ p }}
        </button>
      </template>

      <button
        type="button"
        aria-label="Наступна сторінка"
        :disabled="normalizedPage >= normalizedTotalPages || disabled"
        class="relative flex h-9 w-9 items-center justify-center rounded-control border border-line text-muted transition-colors hover:border-line-strong hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8 pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-12"
        @click="goTo(normalizedPage + 1)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </nav>
  </div>
</template>
