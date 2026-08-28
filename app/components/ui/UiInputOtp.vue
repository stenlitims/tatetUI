<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { errorTextClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    length?: number
    type?: 'numeric' | 'alphanumeric'
    mask?: boolean
    disabled?: boolean
    required?: boolean
    id?: string
    name?: string
    label?: string
    hint?: string
    error?: string
    autocomplete?: string
  }>(),
  {
    modelValue: '',
    length: 6,
    type: 'numeric',
    mask: false,
    disabled: false,
    required: false,
    autocomplete: 'one-time-code',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  complete: [value: string]
}>()

const generatedId = useId()
const inputId = computed(() => props.id || `${generatedId}-otp`)
const hintId = computed(() => props.hint && !props.error ? `${inputId.value}-hint` : undefined)
const errorId = computed(() => props.error ? `${inputId.value}-error` : undefined)
const inputEl = ref<HTMLInputElement | null>(null)
const safeLength = computed(() => Math.max(1, Math.floor(props.length)))

function sanitize(value: string) {
  const normalized = props.type === 'numeric'
    ? value.replace(/\D/g, '')
    : value.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return normalized.slice(0, safeLength.value)
}

const cells = computed(() => {
  const value = sanitize(props.modelValue)
  return Array.from({ length: safeLength.value }, (_, index) => value[index] || '')
})

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = sanitize(input.value)
  input.value = value
  emit('update:modelValue', value)
  if (value.length === safeLength.value) emit('complete', value)
}

watch([() => props.modelValue, safeLength, () => props.type], () => {
  const value = sanitize(props.modelValue)
  if (value !== props.modelValue) emit('update:modelValue', value)
})

defineExpose({ focus: () => inputEl.value?.focus(), select: () => inputEl.value?.select() })
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="inputId" :class="labelClass">
      {{ label }}<span v-if="required" class="text-danger" aria-hidden="true"> *</span>
    </label>

    <div
      class="relative inline-grid max-w-full grid-flow-col gap-2 rounded-control focus-within:outline-none focus-within:ring-2 focus-within:ring-ring"
      :class="{ 'cursor-not-allowed opacity-50': disabled }"
      @click="inputEl?.focus()"
    >
      <input
        :id="inputId"
        ref="inputEl"
        :name="name"
        :value="sanitize(modelValue)"
        :inputmode="type === 'numeric' ? 'numeric' : 'text'"
        :pattern="type === 'numeric' ? `[0-9]{${safeLength}}` : undefined"
        :autocomplete="autocomplete"
        :disabled="disabled"
        :required="required"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="errorId || hintId"
        :aria-label="label ? undefined : `Одноразовий код із ${safeLength} символів`"
        class="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 disabled:cursor-not-allowed"
        @input="onInput"
      >
      <span
        v-for="(cell, index) in cells"
        :key="index"
        aria-hidden="true"
        class="flex size-11 items-center justify-center rounded-control border bg-input text-lg font-semibold text-ink transition-colors md:size-10"
        :class="error ? 'border-danger' : 'border-line'"
      >
        {{ cell ? (mask ? '•' : cell) : '' }}
      </span>
    </div>

    <p v-if="error" :id="errorId" role="alert" :class="errorTextClass">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
