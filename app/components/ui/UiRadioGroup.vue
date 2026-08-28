<script setup lang="ts">
import { computed, nextTick, onBeforeUpdate, shallowRef, useId } from 'vue'
import { errorTextClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

export interface RadioOption {
  value: string | number
  label: string
  description?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null
    options: RadioOption[]
    label?: string
    orientation?: 'horizontal' | 'vertical'
    disabled?: boolean
    required?: boolean
    error?: string
    hint?: string
    id?: string
    name?: string
  }>(),
  { modelValue: null, orientation: 'vertical' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  change: [value: string | number]
}>()

defineSlots<{
  option?: (props: { option: RadioOption; selected: boolean }) => unknown
}>()

const generatedId = useId()
const groupId = computed(() => props.id ?? `${generatedId}-radio-group`)
const labelId = `${generatedId}-label`
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`
const inputs = shallowRef<(HTMLInputElement | null)[]>([])

onBeforeUpdate(() => {
  inputs.value = []
})

const enabled = computed(() =>
  props.options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled),
)
const tabStop = computed(() => {
  const selected = enabled.value.find(({ option }) => option.value === props.modelValue)
  return selected?.index ?? enabled.value[0]?.index ?? -1
})
const describedBy = computed(() => props.error ? errorId : props.hint ? hintId : undefined)

function select(option: RadioOption) {
  if (props.disabled || option.disabled || option.value === props.modelValue) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  if (!enabled.value.length) return
  event.preventDefault()
  let position = enabled.value.findIndex((entry) => entry.index === index)
  if (position < 0) position = 0
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') position = (position + 1) % enabled.value.length
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') position = (position - 1 + enabled.value.length) % enabled.value.length
  else if (event.key === 'Home') position = 0
  else position = enabled.value.length - 1
  const target = enabled.value[position]
  if (!target) return
  select(target.option)
  void nextTick(() => inputs.value[target.index]?.focus())
}
</script>

<template>
  <fieldset :id="groupId" :disabled="disabled" class="min-w-0" :aria-describedby="describedBy">
    <legend v-if="label" :id="labelId" :class="labelClass">
      {{ label }}<span v-if="required" class="text-danger" aria-hidden="true"> *</span>
    </legend>
    <div
      role="radiogroup"
      :aria-labelledby="label ? labelId : undefined"
      :aria-invalid="!!error || undefined"
      :aria-orientation="orientation"
      :class="orientation === 'horizontal' ? 'flex flex-wrap gap-2' : 'space-y-2'"
    >
      <label
        v-for="(option, index) in options"
        :key="option.value"
        class="relative flex min-h-11 items-start gap-2.5 rounded-control border bg-card px-3 py-2.5 transition-colors"
        :class="[
          option.value === modelValue ? 'border-accent-solid bg-primary-50' : 'border-line hover:bg-hover',
          disabled || option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          orientation === 'horizontal' ? 'min-w-36 flex-1' : 'w-full',
        ]"
      >
        <input
          :ref="(el) => (inputs[index] = el as HTMLInputElement)"
          type="radio"
          :name="name"
          :value="option.value"
          :checked="option.value === modelValue"
          :disabled="disabled || option.disabled"
          :required="required"
          :tabindex="disabled ? -1 : index === tabStop ? 0 : -1"
          class="peer mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-solid)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @change="select(option)"
          @keydown="onKeydown($event, index)"
        />
        <span class="min-w-0">
          <slot name="option" :option="option" :selected="option.value === modelValue">
            <span class="block text-sm font-medium text-ink">{{ option.label }}</span>
            <span v-if="option.description" class="mt-0.5 block text-xs text-muted">{{ option.description }}</span>
          </slot>
        </span>
      </label>
    </div>
    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </fieldset>
</template>
