<script setup lang="ts">
import { computed } from 'vue'

/**
 * Сегментний перемикач: вибір ОДНОГО взаємовиключного значення з 2–4
 * видимих одразу варіантів. Це radiogroup, а не вкладки: панелей вмісту
 * тут немає — тільки вибір значення.
 */
const props = withDefaults(
  defineProps<{
    /** Опції перемикача. */
    options: ToggleOption[]
    /** Активне значення. Використовуйте через `v-model`. */
    modelValue?: string | number
    /** Доступна назва групи. ОБОВ'ЯЗКОВА, якщо поруч немає видимого лейбла. */
    ariaLabel?: string
    size?: 'sm' | 'md'
    /** Розтягнути сегменти на всю ширину контейнера. */
    block?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: undefined,
    ariaLabel: undefined,
    size: 'md',
    block: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  /** Обрано інший сегмент. */
  change: [value: string | number]
}>()

defineSlots<{
  /** Власний рендер сегмента. */
  option?: (props: { option: ToggleOption; selected: boolean }) => unknown
}>()

export interface ToggleOption {
  value: string | number
  label: string
  disabled?: boolean
}

function select(option: ToggleOption) {
  if (props.disabled || option.disabled || option.value === props.modelValue) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
}

const trackClass = computed(() => [
  'gap-1 rounded-control bg-hover p-1',
  props.block ? 'flex w-full' : 'inline-flex',
])

const segmentClass = (option: ToggleOption) => [
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius-control)_-_0.125rem)] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  props.size === 'sm' ? 'h-8 px-2.5 text-xs md:h-7' : 'h-11 px-3.5 text-sm md:h-8',
  props.block ? 'flex-1' : '',
  option.value === props.modelValue
    ? 'bg-card text-ink shadow-card'
    : 'text-muted hover:text-ink',
  (props.disabled || option.disabled) && option.value !== props.modelValue
    ? 'cursor-not-allowed opacity-50'
    : '',
]
</script>

<template>
  <div role="radiogroup" :aria-label="ariaLabel" :class="trackClass">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :disabled="disabled || option.disabled"
      :class="segmentClass(option)"
      @click="select(option)"
    >
      <slot name="option" :option="option" :selected="option.value === modelValue">
        {{ option.label }}
      </slot>
    </button>
  </div>
</template>