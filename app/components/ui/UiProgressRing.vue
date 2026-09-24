<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Прогрес 0–max. `null` — невизначений стан (дуга обертається). */
    modelValue?: number | null
    /** Максимум шкали. */
    max?: number
    /** Діаметр кільця в пікселях. */
    size?: number
    /**
     * Товщина кільця в пікселях. Типово — десята частина діаметра, але не
     * тонше 3px: тонша дуга на 24px-індикаторі губиться.
     */
    thickness?: number
    /**
     * Колір дуги — ті самі тони, що в UiProgress: статусний тон, коли
     * кільце саме є повідомленням (квота на 90% — `warning`).
     */
    tone?: 'accent' | 'success' | 'warning' | 'danger'
    /** Доступна назва. Обов'язкова, якщо поруч немає видимого підпису. */
    label?: string
    /**
     * Відсоток у центрі кільця. Від діаметра 40px — менше в кільце число
     * не вміщається читабельним.
     */
    showValue?: boolean
  }>(),
  {
    modelValue: null,
    max: 100,
    size: 48,
    thickness: undefined,
    tone: 'accent',
    label: undefined,
    showValue: false,
  },
)

defineSlots<{
  /** Власний вміст центру: іконка, «3/5», короткий підпис. */
  default?: (props: { percent: number | null }) => unknown
}>()

type Tone = NonNullable<typeof props.tone>

/*
 * `accent`, а не `accent-solid`: дуга — графічний елемент на доріжці
 * `line`, і в темній темі заливковий #2563eb дає на ній лише 2.6:1 — нижче
 * порогу 3:1 (WCAG 1.4.11). Текстовий акцент світлішає в темній темі й
 * тримає ~5:1 в обох.
 */
const TONES: Record<Tone, string> = {
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

const normalizedMax = computed(() => (Number.isFinite(props.max) && props.max > 0 ? props.max : 100))

const normalizedValue = computed(() => {
  if (props.modelValue == null) return null
  if (!Number.isFinite(props.modelValue)) return 0
  return Math.min(Math.max(props.modelValue, 0), normalizedMax.value)
})

const percent = computed(() =>
  normalizedValue.value == null ? null : Math.round((normalizedValue.value / normalizedMax.value) * 100),
)

/*
 * Геометрія в пікселях самого кільця, а не у фіксованому viewBox 0 0 24 24:
 * тоді товщина — справжні пікселі за будь-якого діаметра, і 3px на 24px
 * виглядають так само, як 3px на 96px.
 */
const stroke = computed(() => {
  const requested = props.thickness ?? Math.round(props.size / 10)
  return Math.min(Math.max(requested, 3), props.size / 4)
})
const radius = computed(() => (props.size - stroke.value) / 2)
const center = computed(() => props.size / 2)

// pathLength="100": довжина дуги — просто відсоток, без 2πr у шаблоні.
const dash = computed(() => (percent.value == null ? '25 100' : `${percent.value} 100`))

const valueFontSize = computed(() => `${Math.max(10, Math.round(props.size * 0.24))}px`)
const canShowValue = computed(() => props.showValue && props.size >= 40 && percent.value != null)
</script>

<template>
  <div
    role="progressbar"
    class="relative inline-flex shrink-0 items-center justify-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :aria-label="label"
    :aria-valuemin="0"
    :aria-valuemax="normalizedMax"
    :aria-valuenow="normalizedValue ?? undefined"
  >
    <svg
      class="absolute inset-0 -rotate-90"
      :class="[TONES[tone], percent == null ? 'ui-ring-indeterminate' : '']"
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      fill="none"
      aria-hidden="true"
    >
      <!-- Доріжка — межа, а не тон дуги з прозорістю: під нею видно, де
           кільце закінчується, навіть коли дуга жовта на білому. -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        class="stroke-line"
        :stroke-width="stroke"
      />
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        stroke="currentColor"
        :stroke-width="stroke"
        stroke-linecap="round"
        pathLength="100"
        :stroke-dasharray="dash"
        :opacity="percent === 0 ? 0 : 1"
        class="ui-ring-arc"
      />
    </svg>

    <span
      v-if="$slots.default || canShowValue"
      class="relative flex items-center justify-center font-semibold tabular-nums leading-none text-ink"
      :style="{ fontSize: valueFontSize }"
    >
      <slot :percent="percent">
        <span aria-hidden="true">{{ percent }}%</span>
      </slot>
    </span>
  </div>
</template>

<style scoped>
/*
 * Перехід дуги — у стилях, а не утилітою transition-[stroke-dasharray]:
 * рух між значеннями тієї самої довжини, що й у смуги UiProgress.
 */
.ui-ring-arc {
  transition: stroke-dasharray var(--duration-slow) var(--ease-out);
}

/*
 * Невизначений стан: чверть кола обертається. Обертається вся SVG; у
 * Tailwind v4 `-rotate-90` — це окрема властивість `rotate`, тож вона
 * складається з анімованим `transform`, а не конфліктує з ним.
 */
.ui-ring-indeterminate {
  animation: ui-ring-rotate 1s linear infinite;
}

@keyframes ui-ring-rotate {
  from {
    transform: rotate(0);
  }
  to {
    transform: rotate(1turn);
  }
}

/*
 * Під reduced-motion обертання гасить глобальний вимикач у main.css. Щоб
 * застигла чверть не виглядала як «25 %», невизначене кільце стає
 * повним і напівпрозорим — той самий прийом, що в UiProgress.
 */
@media (prefers-reduced-motion: reduce) {
  .ui-ring-indeterminate .ui-ring-arc {
    stroke-dasharray: 100 100;
    opacity: 0.5;
  }
}
</style>
