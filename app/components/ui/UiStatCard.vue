<script setup lang="ts">
import { computed } from 'vue'
import { NuxtLink } from '#components'
import UiSkeleton from '~/components/ui/UiSkeleton.vue'

const props = withDefaults(
  defineProps<{
    /** Назва метрики. Коротка іменна група: «Замовлення», не «Скільки замовлень». */
    label: string
    /** Головне число. Форматування — на боці споживача, компонент друкує рядок як є. */
    value?: string | number | null
    /**
     * Зміна відносно попереднього періоду. ЗНАК визначає стрілку, а тон —
     * `deltaGood`, і розводити їх обов'язково: для «Відмов» падіння зелене,
     * для «Виручки» — червоне.
     */
    delta?: number | null
    /** Як друкувати `delta`: `12` → «+12 %» або «+12». */
    deltaFormat?: 'percent' | 'absolute'
    /**
     * Який напрям вважати добрим. `none` лишає стрілку, але прибирає колір:
     * метрика змінилась, а «краще» для неї не визначено.
     */
    deltaGood?: 'up' | 'down' | 'none'
    /** Підпис під дельтою: «проти минулого тижня». */
    hint?: string
    /**
     * Повне значення для скрінрідера, коли видиме скорочене («1,2 млн»).
     * Без нього буде зачитано саме скорочення.
     */
    valueLabel?: string
    /** Показує скелетони, зберігаючи висоту плитки — сітка не перебудовується. */
    loading?: boolean
    /** Робить плитку посиланням. Зберігає Ctrl+клік і середній клік. */
    to?: string
    /** Щільність плитки. */
    size?: 'sm' | 'md'
  }>(),
  { deltaFormat: 'percent', deltaGood: 'up', size: 'md' },
)

type DeltaGood = NonNullable<typeof props.deltaGood>
type Size = NonNullable<typeof props.size>

defineSlots<{
  /** Іконка у верхньому правому куті плитки. */
  icon?: () => unknown
  /** Спарклайн або міні-графік під значенням. Компонент нічого не малює сам. */
  trend?: () => unknown
  /** Власний рендер значення: чип, посилання, дві величини поруч. */
  value?: (props: { value: string | number | null }) => unknown
  /** Рядок під дельтою замість `hint`. */
  footer?: () => unknown
}>()

const PADDING: Record<Size, string> = { sm: 'p-4', md: 'p-5' }
const VALUE_SIZE: Record<Size, string> = { sm: 'text-2xl', md: 'text-3xl' }

const hasDelta = computed(() => typeof props.delta === 'number' && Number.isFinite(props.delta))
const direction = computed<'up' | 'down' | 'flat'>(() => {
  if (!hasDelta.value || props.delta === 0) return 'flat'
  return props.delta! > 0 ? 'up' : 'down'
})

/*
 * Тон — таблиця, а не ланцюжок if. З ланцюжком `deltaGood: 'none'` рано чи
 * пізно провалюється у гілку «зростання = добре» і фарбує нейтральну
 * метрику зеленим.
 */
const TONE: Record<DeltaGood, Record<'up' | 'down' | 'flat', string>> = {
  up: { up: 'text-success', down: 'text-danger', flat: 'text-muted' },
  down: { up: 'text-danger', down: 'text-success', flat: 'text-muted' },
  none: { up: 'text-muted', down: 'text-muted', flat: 'text-muted' },
}

const deltaTone = computed(() => TONE[props.deltaGood][direction.value])

const deltaText = computed(() => {
  if (!hasDelta.value) return ''
  const sign = props.delta! > 0 ? '+' : props.delta! < 0 ? '−' : ''
  const magnitude = Math.abs(props.delta!)
  return props.deltaFormat === 'percent' ? `${sign}${magnitude} %` : `${sign}${magnitude}`
})

// Стрілка — символ, і скрінрідер зачитав би її як «трикутник вгору».
// Тому вона aria-hidden, а поруч стоїть словесний еквівалент.
const deltaLabel = computed(() => {
  if (!hasDelta.value) return ''
  const word = direction.value === 'up' ? 'зростання' : direction.value === 'down' ? 'падіння' : 'без змін'
  if (direction.value === 'flat') return 'без змін'
  const magnitude = Math.abs(props.delta!)
  return props.deltaFormat === 'percent' ? `${word} на ${magnitude} відсотків` : `${word} на ${magnitude}`
})

/**
 * Компонент, а НЕ рядок 'NuxtLink' — те саме правило, що в UiButton: рядок
 * у `<component :is>` резолвиться лише проти глобально зареєстрованих
 * компонентів, інакше Vue рендерить літеральний тег <nuxtlink> і плитка
 * перестає бути посиланням.
 */
const rootTag = computed(() => (props.to ? NuxtLink : 'div'))

const rootClass = computed(() => [
  'block rounded-card border border-line bg-card shadow-card transition-colors',
  PADDING[props.size],
  props.to
    ? 'hover:border-line-strong hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset'
    : '',
])
</script>

<template>
  <component :is="rootTag" :to="to || undefined" :class="rootClass">
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm font-medium text-muted">{{ label }}</p>
      <span v-if="$slots.icon" class="shrink-0 text-muted" aria-hidden="true">
        <slot name="icon" />
      </span>
    </div>

    <UiSkeleton v-if="loading" class="mt-3 h-8 w-28" />
    <p v-else class="mt-2 font-semibold tabular-nums tracking-tight text-ink" :class="VALUE_SIZE[size]">
      <span v-if="valueLabel" class="sr-only">{{ valueLabel }}</span>
      <span :aria-hidden="valueLabel ? 'true' : undefined">
        <slot name="value" :value="value ?? null">{{ value ?? '—' }}</slot>
      </span>
    </p>

    <div v-if="$slots.trend" class="mt-3">
      <slot name="trend" />
    </div>

    <UiSkeleton v-if="loading" class="mt-3 h-4 w-36" />
    <div v-else-if="hasDelta || hint || $slots.footer" class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span v-if="hasDelta" class="inline-flex items-center gap-1 font-medium" :class="deltaTone">
        <span aria-hidden="true">{{ direction === 'up' ? '▲' : direction === 'down' ? '▼' : '■' }}</span>
        <span aria-hidden="true">{{ deltaText }}</span>
        <span class="sr-only">{{ deltaLabel }}</span>
      </span>
      <span v-if="hint" class="text-muted">{{ hint }}</span>
      <slot name="footer" />
    </div>
  </component>
</template>
