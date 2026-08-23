<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, watch } from 'vue'
import UiSkeleton from './UiSkeleton.vue'

export interface TableHeader {
  /** Ключ поля в об'єкті рядка. Він же — суфікс іменованих слотів. */
  value: string
  text: string
  sortable?: boolean
  /** Ширина колонки, напр. "12rem" або "20%". */
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface TableSort {
  by: string
  dir: 'asc' | 'desc'
}

const props = withDefaults(
  defineProps<{
    headers: TableHeader[]
    items: T[]
    /** Поле-ідентифікатор рядка для :key. */
    keyRow?: string
    /** Поточне сортування. Використовуйте через `v-model:sort`. */
    sort?: TableSort | null
    /**
     * Сортувати на сервері: компонент лише повідомляє про намір через
     * `update:sort`, але сам порядок рядків не чіпає.
     */
    serverSort?: boolean
    loading?: boolean
    /** Скільки рядків-заглушок показати під час першого завантаження. */
    skeletonRows?: number
    /** Текст, коли даних немає. */
    emptyText?: string
    density?: 'sm' | 'md'
    /** Робить рядки клікабельними й вмикає подію `rowClick`. */
    rowClickable?: boolean
    /**
     * Нижче `md` таблиця ховається, а замість неї рендериться список
     * карток — із ТИХ САМИХ слотів `cell-*`. Одне API, дві верстки.
     */
    mobileCards?: boolean
    /** Закріпити шапку. Вимагає `maxHeight`, інакше не діє. */
    stickyHeader?: boolean
    /** Напр. "24rem". Без нього `stickyHeader` не має де закріплюватись. */
    maxHeight?: string
  }>(),
  {
    keyRow: 'id',
    sort: null,
    skeletonRows: 5,
    emptyText: 'Даних немає',
    density: 'md',
  },
)

const emit = defineEmits<{
  'update:sort': [value: TableSort | null]
  rowClick: [item: T]
}>()

/*
 * defineSlots із generic="T" обов'язковий: для генеричних компонентів
 * vue-component-meta не читає слоти з шаблону (language-tools#3429), і
 * таблиця API лишилася б без секції «Слоти».
 *
 * Динамічні `cell-*` / `header-*` тут описати неможливо — їхні імена
 * залежать від headers. Тому вони згадані у slot-описах як шаблон.
 */
defineSlots<{
  /** `cell-<value>` — власний рендер комірки. Приклад: `#cell-status`. */
  [key: `cell-${string}`]: (props: { item: T; header: TableHeader }) => unknown
  /** `header-<value>` — власний рендер заголовка колонки. */
  [key: `header-${string}`]: (props: { header: TableHeader }) => unknown
  /** Вміст картки нижче `md`, якщо стандартний список пар не підходить. */
  'mobile-card'?: (props: { item: T }) => unknown
  /** Показується замість «Даних немає». */
  empty?: () => unknown
}>()

const internalSort = ref<TableSort | null>(props.sort)
watch(() => props.sort, (value) => (internalSort.value = value))

const densityClasses = computed(() =>
  props.density === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2.5 text-sm',
)

/**
 * Порівняння з урахуванням чисел і локалі.
 *
 * Наївні `<` і `>` дають «Файл 10» перед «Файл 9», а кирилицю сортують за
 * кодами символів. `numeric: true` розв'язує перше, `localeCompare` — друге.
 * Порожні значення завжди в кінці, незалежно від напрямку: рядок без даних
 * не має витісняти заповнені з початку списку.
 */
function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1

  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)

  return String(a).localeCompare(String(b), 'uk', { numeric: true, sensitivity: 'base' })
}

const sortedItems = computed(() => {
  const sort = internalSort.value
  if (!sort || props.serverSort) return props.items
  const factor = sort.dir === 'asc' ? 1 : -1
  // Копія: сортування на місці мутувало б масив, переданий ззовні.
  return [...props.items].sort((a, b) => factor * compareValues(a[sort.by], b[sort.by]))
})

function toggleSort(header: TableHeader) {
  if (!header.sortable) return
  const current = internalSort.value
  let next: TableSort | null
  if (current?.by !== header.value) next = { by: header.value, dir: 'asc' }
  else if (current.dir === 'asc') next = { by: header.value, dir: 'desc' }
  // Третій клік скидає сортування — інакше повернутися до вихідного
  // порядку можна лише перезавантаженням сторінки.
  else next = null

  internalSort.value = next
  emit('update:sort', next)
}

function ariaSort(header: TableHeader): 'ascending' | 'descending' | 'none' | undefined {
  if (!header.sortable) return undefined
  if (internalSort.value?.by !== header.value) return 'none'
  return internalSort.value.dir === 'asc' ? 'ascending' : 'descending'
}

const alignClass = (header: TableHeader) =>
  header.align === 'right' ? 'text-right' : header.align === 'center' ? 'text-center' : 'text-left'

const showSkeleton = computed(() => props.loading && props.items.length === 0)
const showEmpty = computed(() => !props.loading && sortedItems.value.length === 0)
</script>

<template>
  <div>
    <!-- Десктопна таблиця -->
    <div
      class="scrollbar-thin relative overflow-auto rounded-card border border-line"
      :class="mobileCards ? 'hidden md:block' : ''"
      :style="maxHeight ? { maxHeight } : undefined"
    >
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b border-line bg-subtle">
            <th
              v-for="header in headers"
              :key="header.value"
              scope="col"
              :style="header.width ? { width: header.width } : undefined"
              :aria-sort="ariaSort(header)"
              class="font-medium text-muted"
              :class="[
                densityClasses,
                alignClass(header),
                stickyHeader && maxHeight ? 'sticky top-0 z-10 bg-subtle' : '',
              ]"
            >
              <slot :name="`header-${header.value}`" :header="header">
                <button
                  v-if="header.sortable"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-control transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  @click="toggleSort(header)"
                >
                  {{ header.text }}
                  <svg
                    class="h-3 w-3 transition-opacity"
                    :class="internalSort?.by === header.value ? 'opacity-100' : 'opacity-30'"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      :d="
                        internalSort?.by === header.value && internalSort.dir === 'desc'
                          ? 'M6 9l6 6 6-6'
                          : 'M6 15l6-6 6 6'
                      "
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
                <span v-else>{{ header.text }}</span>
              </slot>
            </th>
          </tr>
        </thead>

        <tbody>
          <!--
            v-if і v-for навмисно РОЗНЕСЕНІ по різних вузлах. На одному
            елементі у Vue 3 v-if має вищий пріоритет і не бачить змінної
            циклу — тут воно спрацювало б випадково (умова не залежить від
            row), але наступна правка мовчки зламала б рендер.
          -->
          <template v-if="showSkeleton">
            <tr v-for="row in skeletonRows" :key="`sk-${row}`" class="border-b border-line last:border-0">
              <td v-for="header in headers" :key="header.value" :class="densityClasses">
                <!-- Ширина заглушки детермінована, а не Math.random(): інакше
                     вона мінялася б на кожному рендері й миготіла. -->
                <UiSkeleton
                  class="h-3"
                  :style="{ width: `${55 + ((row * 17 + header.value.length * 13) % 40)}%` }"
                />
              </td>
            </tr>
          </template>

          <tr v-else-if="showEmpty">
            <td :colspan="headers.length" class="p-0">
              <slot name="empty">
                <p class="px-4 py-10 text-center text-sm text-muted">{{ emptyText }}</p>
              </slot>
            </td>
          </tr>

          <template v-else>
            <tr
              v-for="item in sortedItems"
              :key="String(item[keyRow])"
              class="border-b border-line transition-colors last:border-0"
              :class="rowClickable ? 'cursor-pointer hover:bg-hover' : ''"
              @click="rowClickable && emit('rowClick', item)"
            >
              <td
                v-for="header in headers"
                :key="header.value"
                :class="[densityClasses, alignClass(header), 'text-ink']"
              >
                <slot :name="`cell-${header.value}`" :item="item" :header="header">
                  {{ item[header.value] ?? '—' }}
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Оверлей оновлення: дані вже є, але йде повторний запит. Заміняти
           їх скелетоном було б гірше — таблиця блимала б на кожному фільтрі. -->
      <div
        v-if="loading && items.length > 0"
        class="absolute inset-0 flex items-start justify-center bg-card/60 pt-10"
        aria-hidden="true"
      >
        <span class="text-sm text-muted">Оновлення…</span>
      </div>
    </div>

    <!-- Мобільні картки з ТИХ САМИХ слотів cell-* -->
    <div v-if="mobileCards" class="space-y-2 md:hidden">
      <p v-if="showEmpty" class="rounded-card border border-line px-4 py-10 text-center text-sm text-muted">
        {{ emptyText }}
      </p>
      <div
        v-for="item in showEmpty ? [] : sortedItems"
        :key="`m-${String(item[keyRow])}`"
        class="rounded-card border border-line bg-card p-3"
        :class="rowClickable ? 'cursor-pointer' : ''"
        @click="rowClickable && emit('rowClick', item)"
      >
        <slot name="mobile-card" :item="item">
          <dl class="space-y-1.5">
            <div v-for="header in headers" :key="header.value" class="flex justify-between gap-3 text-sm">
              <dt class="shrink-0 text-muted">{{ header.text }}</dt>
              <dd class="min-w-0 text-right text-ink">
                <slot :name="`cell-${header.value}`" :item="item" :header="header">
                  {{ item[header.value] ?? '—' }}
                </slot>
              </dd>
            </div>
          </dl>
        </slot>
      </div>
    </div>
  </div>
</template>
