<script setup lang="ts">
import { computed } from 'vue'

export interface TimelineItem {
  /** Стабільний ключ для `:key`. */
  id: string | number
  /** Що сталося. Формулюйте як подію, а не як стан. */
  title: string
  /** Подробиці під заголовком. */
  description?: string
  /**
   * Машинна мітка ISO 8601 для `<time datetime>`. Джерело і семантики, і —
   * якщо немає `time` — видимого підпису.
   */
  datetime?: string
  /** Готовий видимий підпис часу. Перекриває форматування `datetime`. */
  time?: string
  /** Смисловий колір крапки. */
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

const props = withDefaults(
  defineProps<{
    /** Події в порядку показу. */
    items: TimelineItem[]
    /** Тег кореня. `ol` — хронологія, `ul` — набір подій без порядку. */
    as?: 'ol' | 'ul'
    /** Щільність. `sm` для довгих стрічок. */
    density?: 'sm' | 'md'
    /** Лінія-конектор між крапками. */
    connector?: boolean
    /** Що саме друкувати з `datetime`. */
    dateFormat?: 'date' | 'datetime' | 'time'
    /**
     * Часовий пояс форматування — ЯВНИЙ навмисно.
     *
     * Сторінки прередеряться в Node, а гідратуються в браузері. Без
     * фіксованого поясу `Intl` бере пояс процесу, і сервер із клієнтом
     * друкують різний час — гідратаційний розсинхрон на кожній події.
     */
    timeZone?: string
    /** Локаль форматування дати. */
    locale?: string
    /** Текст, коли подій немає. */
    emptyText?: string
  }>(),
  {
    as: 'ol',
    density: 'md',
    connector: true,
    dateFormat: 'datetime',
    timeZone: 'Europe/Kyiv',
    locale: 'uk-UA',
    emptyText: 'Подій немає',
  },
)

type Density = NonNullable<typeof props.density>
type Tone = NonNullable<TimelineItem['tone']>

defineSlots<{
  /** Повний рендер однієї події замість заголовка й опису. */
  item?: (props: { item: TimelineItem; index: number; last: boolean }) => unknown
  /** Вміст маркера: іконка замість крапки. */
  dot?: (props: { item: TimelineItem; index: number }) => unknown
  /** Показується замість `emptyText`, коли подій немає. */
  empty?: () => unknown
}>()

const DOT_TONE: Record<Tone, string> = {
  accent: 'bg-accent-solid',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-neutral',
}

/*
 * Одна константа на щільність — і крапка, і відступ, і положення лінії
 * рахуються з неї. Якщо розвести їх по різних місцях, зміна щільності
 * розсинхронізує крапку з конектором на пів пікселя, і це видно.
 */
const DENSITY: Record<Density, { gap: string; pad: string; dot: string; line: string; text: string }> = {
  sm: { gap: 'gap-3', pad: 'pb-4', dot: 'h-2 w-2 mt-1.5', line: 'left-[3px] top-4', text: 'text-sm' },
  md: { gap: 'gap-4', pad: 'pb-6', dot: 'h-2.5 w-2.5 mt-1.5', line: 'left-[4px] top-5', text: 'text-sm' },
}

const formatter = computed(() => {
  const options: Intl.DateTimeFormatOptions = { timeZone: props.timeZone }
  if (props.dateFormat === 'date') Object.assign(options, { day: 'numeric', month: 'long', year: 'numeric' })
  else if (props.dateFormat === 'time') Object.assign(options, { hour: '2-digit', minute: '2-digit' })
  else Object.assign(options, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return new Intl.DateTimeFormat(props.locale, options)
})

function visibleTime(item: TimelineItem): string {
  if (item.time) return item.time
  if (!item.datetime) return ''
  const parsed = new Date(item.datetime)
  return Number.isNaN(parsed.getTime()) ? '' : formatter.value.format(parsed)
}
</script>

<template>
  <div v-if="!items.length">
    <slot name="empty">
      <p class="text-sm text-muted">{{ emptyText }}</p>
    </slot>
  </div>

  <component :is="as" v-else class="list-none">
    <li
      v-for="(item, index) in items"
      :key="item.id"
      class="relative flex"
      :class="[DENSITY[density].gap, index === items.length - 1 ? '' : DENSITY[density].pad]"
    >
      <!--
        Конектор — окремий сегмент на кожній події, крім останньої. Одна
        наскрізна лінія на контейнері звисала б нижче останньої крапки
        щоразу, коли остання подія коротша за попередні.
      -->
      <span
        v-if="connector && index !== items.length - 1"
        aria-hidden="true"
        class="absolute bottom-0 w-px bg-line"
        :class="DENSITY[density].line"
      />

      <span class="relative z-10 shrink-0">
        <slot name="dot" :item="item" :index="index">
          <!-- ring-card відриває крапку від лінії конектора: без просвіту
               крапка й лінія зливаються в одну паличку з потовщенням. -->
          <span
            aria-hidden="true"
            class="block rounded-full ring-4 ring-card"
            :class="[DENSITY[density].dot, DOT_TONE[item.tone ?? 'neutral']]"
          />
        </slot>
      </span>

      <div class="min-w-0 flex-1">
        <slot name="item" :item="item" :index="index" :last="index === items.length - 1">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p class="font-medium text-ink" :class="DENSITY[density].text">{{ item.title }}</p>
            <time v-if="visibleTime(item)" :datetime="item.datetime" class="shrink-0 text-xs text-muted">
              {{ visibleTime(item) }}
            </time>
          </div>
          <p v-if="item.description" class="mt-1 text-sm leading-relaxed text-muted">
            {{ item.description }}
          </p>
        </slot>
      </div>
    </li>
  </component>
</template>
