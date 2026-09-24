<script setup lang="ts">
import { computed, nextTick, onBeforeUpdate, ref } from 'vue'

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
    /** Висота сегментів. На дотику точність дає невидима зона 45×45. */
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

const optionEls = ref<(HTMLButtonElement | null)[]>([])

onBeforeUpdate(() => {
  optionEls.value = []
})

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

const enabledOptions = computed(() =>
  props.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled),
)

const tabStopIndex = computed(() => {
  const selected = enabledOptions.value.find(
    ({ option }) => option.value === props.modelValue,
  )
  return selected?.index ?? enabledOptions.value[0]?.index ?? -1
})

function onKeydown(event: KeyboardEvent, index: number) {
  if (props.disabled) return
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    return
  }
  const enabled = enabledOptions.value
  if (!enabled.length) return
  event.preventDefault()
  let position = enabled.findIndex((entry) => entry.index === index)
  if (position < 0) position = 0
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    position = (position + 1) % enabled.length
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    position = (position - 1 + enabled.length) % enabled.length
  } else if (event.key === 'Home') position = 0
  else position = enabled.length - 1
  const target = enabled[position]
  if (!target) return
  select(target.option)
  void nextTick(() => optionEls.value[target.index]?.focus())
}

const trackClass = computed(() => [
  'gap-1 rounded-control bg-hover p-1',
  props.block ? 'flex w-full' : 'inline-flex',
])

const segmentClass = (option: ToggleOption) => [
  // relative — якір для невидимої зони дотику нижче. Без нього ::after
  // позиціювався від найближчого позиціонованого предка (картки, sticky-
  // шапки, модалки): зони всіх сегментів злипались у його центрі, і тап по
  // чужій кнопці там обирав ОСТАННІЙ варіант, а самі сегменти лишались
  // дрібними.
  'relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius-control)_-_0.125rem)] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  // На мобільному сегменти лишаються компактними (sm 8 / md 9), зону дотику
  // 45×45 кожному дає pointer-coarse:after: — той самий патерн, що в
  // UiButton. Раніше md здувався до h-11, і сегментний перемикач вище за
  // поле, у якому він стоїть.
  props.size === 'sm' ? 'h-8 px-2.5 text-xs md:h-7' : 'h-9 px-3.5 text-sm md:h-8',
  'pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[\'\'] pointer-coarse:after:h-12 pointer-coarse:after:w-12',
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
      v-for="(option, index) in options"
      :key="option.value"
      :ref="(el) => (optionEls[index] = el as HTMLButtonElement)"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :disabled="disabled || option.disabled"
      :tabindex="disabled ? -1 : index === tabStopIndex ? 0 : -1"
      :class="segmentClass(option)"
      @click="select(option)"
      @keydown="onKeydown($event, index)"
    >
      <slot name="option" :option="option" :selected="option.value === modelValue">
        {{ option.label }}
      </slot>
    </button>
  </div>
</template>
