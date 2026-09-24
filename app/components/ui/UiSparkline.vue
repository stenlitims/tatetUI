<script setup lang="ts">
import { computed, useId } from 'vue'
import {
  SPARK_WIDTH,
  areaPath,
  sparkBars,
  sparkDomain,
  sparkSegments,
  sparkSummary,
  segmentPath,
} from '~/utils/sparkline'

const props = withDefaults(
  defineProps<{
    /**
     * Ряд значень, від старого до нового. `NaN` — пропуск: лінія рветься, а
     * не падає в нуль (день без даних — не день без продажів).
     */
    data: number[]
    /** Вигляд: лінія, лінія із заливкою або стовпчики. */
    variant?: 'line' | 'area' | 'bar'
    /**
     * Колір. Тон — рішення споживача, а не компонента: зростання відтоку —
     * погана новина, і автоматичне «вгору = зелене» тут збрехало б.
     */
    tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
    /** Висота в пікселях. Ширина — уся ширина батька. */
    height?: number
    /** Товщина лінії в пікселях — однакова за будь-якої ширини. */
    strokeWidth?: number
    /**
     * `smooth` — монотонна крива: плавна, але ніколи не виходить за сусідні
     * значення, тож не вигадує піків і провалів, яких у даних немає.
     */
    curve?: 'linear' | 'smooth'
    /** Крапка на останньому значенні — «де ми зараз». */
    showLastPoint?: boolean
    /** Нижня межа шкали. Типово — мінімум даних (для стовпчиків — нуль). */
    min?: number
    /** Верхня межа шкали. Типово — максимум даних. */
    max?: number
    /**
     * Доступна назва. Без неї компонент складає підсумок сам: «зростання:
     * від 120 до 180, мінімум 96, максимум 210».
     */
    label?: string
    /** Форматування чисел в автоматичному підсумку: валюта, одиниці. */
    formatValue?: (value: number) => string
  }>(),
  {
    variant: 'line',
    tone: 'accent',
    height: 32,
    strokeWidth: 2,
    curve: 'smooth',
    showLastPoint: false,
    min: undefined,
    max: undefined,
    label: undefined,
    formatValue: undefined,
  },
)

defineSlots<Record<string, never>>()

type Tone = NonNullable<typeof props.tone>

const TONES: Record<Tone, string> = {
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-muted',
}

/*
 * id градієнта — з useId, а не з лічильника: той самий на сервері й у
 * браузері, тож прередерений HTML гідратується без розбіжності. Двокрапки
 * й інші символи з префікса вирізаються — `url(#…)` їх не пережовує.
 */
const gradientId = `spark-${useId().replace(/[^\w-]/g, '')}`

const numberFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })
const format = (value: number) => (props.formatValue ? props.formatValue(value) : numberFormat.format(value))

const isBar = computed(() => props.variant === 'bar')

/*
 * Відступ згори й знизу — половина товщини лінії плюс крапка: без нього
 * максимум лягає на самий край, і верхня половина лінії обрізається.
 */
const padding = computed(() => Math.max(props.strokeWidth / 2, props.showLastPoint && !isBar.value ? 3.5 : 0) + 1)

const domain = computed(() =>
  sparkDomain(props.data, { min: props.min, max: props.max, includeZero: isBar.value }),
)

const segments = computed(() =>
  isBar.value ? [] : sparkSegments(props.data, { height: props.height, padding: padding.value, domain: domain.value }),
)

const linePaths = computed(() => segments.value.map((segment) => segmentPath(segment, props.curve)))
const areaPaths = computed(() =>
  props.variant === 'area'
    ? segments.value.map((segment) => areaPath(segment, props.curve, props.height))
    : [],
)

const bars = computed(() =>
  isBar.value ? sparkBars(props.data, { height: props.height, padding: 1, domain: domain.value }) : [],
)

/*
 * Остання точка — HTML-крапка поверх SVG, а не <circle>: preserveAspectRatio
 * ="none" розтягує коло в еліпс, щойно ширина відрізняється від висоти.
 * Позиція — у відсотках, тож крапка їде разом із лінією на будь-якій ширині.
 */
const lastPoint = computed(() => {
  if (!props.showLastPoint || isBar.value) return null
  const segment = segments.value.at(-1)
  const point = segment?.at(-1)
  if (!point || point.index !== props.data.length - 1) return null
  return { left: `${(point.x / SPARK_WIDTH) * 100}%`, top: `${(point.y / props.height) * 100}%` }
})

const accessibleName = computed(() => props.label ?? sparkSummary(props.data, format))
</script>

<template>
  <!--
    role="img" + назва: для скрінрідера графік — це одне речення підсумку,
    а не сотня безіменних вершин SVG.
  -->
  <span
    role="img"
    class="relative block w-full"
    :class="TONES[tone]"
    :style="{ height: `${height}px` }"
    :aria-label="accessibleName"
  >
    <svg
      class="block h-full w-full overflow-visible"
      :viewBox="`0 0 ${SPARK_WIDTH} ${height}`"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <defs v-if="variant === 'area'">
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.24" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>

      <template v-if="isBar">
        <rect
          v-for="bar in bars"
          :key="bar.index"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          fill="currentColor"
          :opacity="bar.index === data.length - 1 ? 1 : 0.55"
        />
      </template>

      <template v-else>
        <path
          v-for="(path, index) in areaPaths"
          :key="`area-${index}`"
          :d="path"
          :fill="`url(#${gradientId})`"
          stroke="none"
        />
        <path
          v-for="(path, index) in linePaths"
          :key="`line-${index}`"
          :d="path"
          stroke="currentColor"
          :stroke-width="strokeWidth"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </template>
    </svg>

    <span
      v-if="lastPoint"
      class="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-card"
      :style="lastPoint"
      aria-hidden="true"
    />
  </span>
</template>
