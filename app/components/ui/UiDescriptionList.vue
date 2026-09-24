<script setup lang="ts">
import { computed } from 'vue'

export interface DescriptionItem {
  /** Ключ поля. Він же — суфікс слота `value-<key>`. */
  key: string
  /** Назва поля — вміст `<dt>`. */
  term: string
  /** Готове значення. Складніший вміст — через слот `value-<key>`. */
  value?: string | number | null
  /** Значення займає обидві колонки: адреса, коментар, довгий опис. */
  wide?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Пари «назва — значення» у порядку показу. */
    items: DescriptionItem[]
    /**
     * `stacked` — назва над значенням; `inline` — назва ліворуч, значення
     * праворуч. На мобільному `inline` лишається inline: саме заради цього
     * вигляду пару «назва / значення» й не роблять таблицею.
     */
    layout?: 'stacked' | 'inline'
    /** Скільки колонок ПАР на десктопі. Нижче `md` завжди одна. */
    columns?: 1 | 2
    /** Щільність рядків. */
    size?: 'sm' | 'md'
    /** Що друкувати замість порожнього значення. */
    emptyText?: string
    /** Лінія-роздільник між рядками. */
    divided?: boolean
  }>(),
  { layout: 'stacked', columns: 2, size: 'md', emptyText: '—', divided: false },
)

type Layout = NonNullable<typeof props.layout>
type Size = NonNullable<typeof props.size>

defineSlots<{
  /** `value-<key>` — власний рендер значення. Приклад: `#value-status`. */
  [key: `value-${string}`]: (props: { item: DescriptionItem }) => unknown
  /** Показується замість списку, коли `items` порожній. */
  empty?: () => unknown
}>()

/*
 * grid-cols-2 просто на <dl> дав би НЕ дві колонки пар, а назву в першій
 * колонці й значення в другій — тобто inline-розкладку. Дві колонки пар
 * вимагають, щоб кожна пара була обгорнута у <div> (це легально всередині
 * <dl>), а сітка стояла на самому <dl>.
 */
const COLUMNS: Record<1 | 2, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
}

// Класи-літерали: Tailwind не бачить інтерпольованих рядків.
const GAP: Record<Size, string> = { sm: 'gap-x-8 gap-y-3', md: 'gap-x-10 gap-y-4' }
const TERM: Record<Size, string> = { sm: 'text-xs', md: 'text-sm' }
const VALUE: Record<Size, string> = { sm: 'text-sm', md: 'text-sm' }

const isEmpty = computed(() => props.items.length === 0)

/*
 * `min-w-0` на парі й на значенні, `break-words` на значенні — не
 * косметика. URL, IBAN, email чи ідентифікатор — одне неподільне слово:
 * у inline-розкладці воно виштовхувало `<dd>` за межу картки, а у двох
 * колонках налазило на сусідню пару (виміряно в Chromium). Той самий
 * захист, що в мобільній картці UiTable.
 */
const itemClass = (item: DescriptionItem) => [
  'min-w-0',
  props.layout === 'inline' ? 'flex items-baseline justify-between gap-4' : '',
  props.divided ? 'border-b border-line pb-3 last:border-0 last:pb-0' : '',
  item.wide && props.columns === 2 ? 'md:col-span-2' : '',
]
</script>

<template>
  <div v-if="isEmpty">
    <slot name="empty">
      <p class="text-sm text-muted">{{ emptyText }}</p>
    </slot>
  </div>

  <dl v-else class="grid" :class="[COLUMNS[columns], GAP[size]]">
    <div v-for="item in items" :key="item.key" :class="itemClass(item)">
      <dt class="font-medium text-muted" :class="TERM[size]">{{ item.term }}</dt>
      <dd
        class="min-w-0 break-words text-ink"
        :class="[VALUE[size], layout === 'inline' ? 'text-right' : 'mt-1']"
      >
        <slot :name="`value-${item.key}`" :item="item">
          {{ item.value === null || item.value === undefined || item.value === '' ? emptyText : item.value }}
        </slot>
      </dd>
    </div>
  </dl>
</template>
