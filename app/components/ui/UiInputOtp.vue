<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { errorTextClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

const props = withDefaults(
  defineProps<{
    /** Введений код. Використовуйте через `v-model`. */
    modelValue?: string
    /** Кількість символів коду. */
    length?: number
    /**
     * Які символи приймати. `numeric` вмикає й числову клавіатуру на
     * телефоні — літерна розкладка для коду з цифр коштує зайвого дотику.
     */
    type?: 'numeric' | 'alphanumeric'
    /** Ховати введені символи, як у полі пароля. */
    mask?: boolean
    disabled?: boolean
    required?: boolean
    id?: string
    name?: string
    label?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    /** Текст помилки. Стан помилки вмикає САМА наявність тексту. */
    error?: string
    /**
     * Значення autocomplete. `one-time-code` дозволяє браузеру підставити
     * код зі свіжої SMS — заради цього компонент і побудований на ОДНОМУ
     * полі вводу замість шести окремих.
     */
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

// Слотів немає свідомо: комірки коду малює сам компонент, а єдине поле
// вводу під ними лишається невидимим — вставити туди чужу розмітку
// означало б зламати і вставку з SMS, і позицію каретки.
defineSlots<Record<string, never>>()

const generatedId = useId()
const inputId = computed(() => props.id || `${generatedId}-otp`)
const hintId = computed(() => props.hint && !props.error ? `${inputId.value}-hint` : undefined)
const errorId = computed(() => props.error ? `${inputId.value}-error` : undefined)
const inputEl = ref<HTMLInputElement | null>(null)
const safeLength = computed(() => Math.max(1, Math.floor(props.length)))

/*
 * Підсвічується КОМІРКА, куди піде наступний символ, а не вся група.
 * Кільце навколо шести клітинок каже лише «поле у фокусі»; кільце на
 * одній — ще й «ось тут каретка», і це головне, що треба знати, набираючи
 * код із SMS.
 */
const focused = ref(false)
const activeIndex = computed(() => Math.min(sanitize(props.modelValue).length, safeLength.value - 1))

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
      class="relative inline-grid max-w-full grid-flow-col gap-2 rounded-control"
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
        @focus="focused = true"
        @blur="focused = false"
      >
      <span
        v-for="(cell, index) in cells"
        :key="index"
        aria-hidden="true"
        class="flex size-12 items-center justify-center rounded-control border bg-input text-lg font-semibold text-ink transition-[border-color,box-shadow] md:size-10"
        :class="[
          error ? 'border-danger' : 'border-line',
          focused && index === activeIndex
            ? error
              ? 'border-danger ring-[3px] ring-danger/30'
              : 'border-accent-solid ring-[3px] ring-ring/30'
            : '',
        ]"
      >
        {{ cell ? (mask ? '•' : cell) : '' }}
        <!-- Каретка в активній порожній комірці: без неї не видно, що поле
             чекає на ввід. Блимає лише тим, хто не просив прибрати рух. -->
        <span
          v-if="focused && index === activeIndex && !cell"
          class="ui-otp-caret h-5 w-px bg-ink md:h-4"
        />
      </span>
    </div>

    <p v-if="error" :id="errorId" role="alert" :class="errorTextClass">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>

<style scoped>
@keyframes ui-otp-blink {
  0%,
  45% {
    opacity: 1;
  }
  55%,
  100% {
    opacity: 0;
  }
}

.ui-otp-caret {
  animation: ui-otp-blink 1.1s steps(1) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ui-otp-caret {
    animation: none;
  }
}
</style>
