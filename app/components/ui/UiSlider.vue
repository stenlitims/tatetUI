<script setup lang="ts">
import { computed, useId } from 'vue'
import { errorTextClass, helperTextClass, labelClass, type FieldSize } from '~/utils/uiFieldStyles'

/**
 * Повзунок. Обгортка над нативним <input type="range">: без власного
 * drag-механізму, з нативною клавіатурою (стрілки, Home/End, PageUp/Down)
 * і нативною підтримкою дотику. Власне — тільки стилі й підписи.
 */
const props = withDefaults(
  defineProps<{
    /** Значення. Використовуйте через `v-model`. */
    modelValue?: number | null
    /** Мінімум шкали. */
    min?: number
    /** Максимум шкали. */
    max?: number
    /** Крок стрілками. */
    step?: number
    /** Показувати підписи min/max під смугою. */
    showBounds?: boolean
    /** Показувати числове значення праворуч від лейбла. */
    showValue?: boolean
    /** Суфікс значення: %, px, ℃… */
    unit?: string
    /** Видимий лейбл. Обов'язковий, якщо немає `ariaLabel`. */
    label?: string
    /** Доступна назва — коли лейбла немає. */
    ariaLabel?: string
    disabled?: boolean
    /** Текст помилки. Сама його наявність вмикає стан помилки. */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    name?: string
  }>(),
  {
    modelValue: null,
    min: 0,
    max: 100,
    step: 1,
    showBounds: false,
    showValue: false,
    unit: undefined,
    label: undefined,
    ariaLabel: undefined,
    disabled: false,
    error: undefined,
    hint: undefined,
    name: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

defineSlots<Record<string, never>>()

const generatedId = useId()
const inputId = computed(() => props.name ?? `${generatedId}-slider`)
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`

const hasError = computed(() => !!props.error)

const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  return undefined
})

const value = computed(() => (props.modelValue == null ? props.min : props.modelValue))

const fillPercent = computed(() => ((value.value - props.min) / (props.max - props.min)) * 100)

const valueText = computed(() => (props.unit ? `${value.value}${props.unit}` : String(value.value)))

// aria-valuetext робить читання людським: не «47», а «47 %».
const ariaValueText = computed(() => (props.unit ? `${value.value} ${props.unit}` : undefined))

// CSS-змінна для заливки треку зліва від повзунка — один патерн на обидві теми.
const trackStyle = computed(() => ({ '--fill-percent': `${fillPercent.value}%` }))
</script>

<template>
  <div>
    <div v-if="label || showValue" class="mb-1 flex items-center justify-between gap-2">
      <label v-if="label" :for="inputId" :class="labelClass">{{ label }}</label>
      <span v-if="showValue" class="text-xs tabular-nums text-muted">{{ valueText }}</span>
    </div>

    <div class="relative" :style="trackStyle">
      <input
        :id="inputId"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="value"
        :name="name"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :aria-valuetext="ariaValueText"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        class="ui-slider h-11 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-50 md:h-6"
        @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div v-if="showBounds" class="mt-0.5 flex justify-between text-xs tabular-nums text-muted">
      <span>{{ min }}</span>
      <span>{{ max }}</span>
    </div>

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>

<style scoped>
/*
 * Смуга: тонкий трек із заливкою зліва. WebKit малює градієнтом від
 * CSS-змінної --fill-percent (оновлюється зі script), Firefox має
 * нативний ::-moz-range-progress.
 */
.ui-slider {
  --fill-percent: 0%;
}

.ui-slider::-webkit-slider-runnable-track {
  height: 0.375rem;
  border-radius: 9999px;
  background: linear-gradient(
    to right,
    var(--accent-solid) 0%,
    var(--accent-solid) var(--fill-percent),
    var(--line) var(--fill-percent),
    var(--line) 100%
  );
}

.ui-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -0.3125rem;
  height: 1rem;
  width: 1rem;
  border-radius: 9999px;
  background: var(--bg-card);
  border: 2px solid var(--accent-solid);
  box-shadow: var(--shadow-card);
}

.ui-slider::-moz-range-track {
  height: 0.375rem;
  border-radius: 9999px;
  background: var(--line);
}

.ui-slider::-moz-range-progress {
  height: 0.375rem;
  border-radius: 9999px;
  background: var(--accent-solid);
}

.ui-slider::-moz-range-thumb {
  height: 1rem;
  width: 1rem;
  border-radius: 9999px;
  background: var(--bg-card);
  border: 2px solid var(--accent-solid);
  box-shadow: var(--shadow-card);
}

/*
 * На дотику input високий (h-11 = 44px), хоч трек візуально тонкий:
 * пальцю є в що влучити, а вигляд лишається компактним. На десктопі
 * висота повертається до md:h-6.
 */
</style>