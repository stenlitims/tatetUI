<script setup lang="ts">
import { computed, ref, useId, useSlots } from 'vue'
import {
  errorTextClass,
  fieldClass,
  helperTextClass,
  labelClass,
  type FieldSize,
} from '~/utils/uiFieldStyles'

const props = withDefaults(
  defineProps<{
    /** Значення поля. Використовуйте через `v-model`. */
    modelValue?: string | number | null
    /** Видимий лейбл. Пов'язується з полем через `for`/`id` автоматично. */
    label?: string
    placeholder?: string
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'
    size?: FieldSize
    disabled?: boolean
    readonly?: boolean
    required?: boolean
    /**
     * Текст помилки. Сама його наявність вмикає стан помилки — окремого
     * булевого прапорця немає навмисно, щоб не було стану «червоне поле
     * без пояснення чому».
     */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    autocomplete?: string
    /** Стабільний DOM id. `name` використовується лише для форми. */
    id?: string
    name?: string
  }>(),
  { type: 'text', size: 'md' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

defineSlots<{
  /** Іконка або кнопка ліворуч усередині поля. */
  leading?: () => unknown
  /** Іконка або кнопка праворуч усередині поля. */
  trailing?: () => unknown
}>()

const generatedId = useId()
const inputId = computed(() => props.id ?? `${generatedId}-input`)
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`

const inputEl = ref<HTMLInputElement | null>(null)

const hasError = computed(() => !!props.error)

/*
 * aria-describedby вказує рівно на один активний опис. Якщо передати обидва
 * id, скрінрідер зачитає і підказку, і помилку підряд — користувач почує
 * інструкцію, яку щойно порушив, раніше за причину відмови.
 */
const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  return undefined
})

// useSlots() для рантайм-перевірки; defineSlots вище — лише для типів і
// таблиці API. Двічі defineSlots викликати не можна.
const slots = useSlots()

const inputClasses = computed(() =>
  fieldClass(props.size, {
    error: hasError.value,
    disabled: props.disabled,
    // Відступ під іконку інакше накладеться на текст введення.
    extra: [slots.leading ? 'pl-9' : '', slots.trailing ? 'pr-9' : ''].filter(Boolean).join(' '),
  }),
)

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  // Порожній числовий інпут дає '' — віддаємо null, щоб не отримати NaN
  // на першому ж арифметичному використанні.
  if (props.type === 'number') {
    emit('update:modelValue', target.value === '' ? null : Number(target.value))
    return
  }
  emit('update:modelValue', target.value)
}

defineExpose({
  /** Ставить фокус на поле. */
  focus: () => inputEl.value?.focus(),
  /** Виділяє весь текст. */
  select: () => inputEl.value?.select(),
})
</script>

<template>
  <div>
    <label v-if="label" :for="inputId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <span
        v-if="$slots.leading"
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted"
      >
        <slot name="leading" />
      </span>

      <input
        :id="inputId"
        ref="inputEl"
        :value="modelValue ?? ''"
        :type="type"
        :name="name"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :autocomplete="autocomplete"
        :class="inputClasses"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        @input="onInput"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
      />

      <span
        v-if="$slots.trailing"
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-muted"
      >
        <slot name="trailing" />
      </span>
    </div>

    <!-- role="alert" лише на помилці: підказка не має перебивати те, що
         користувач читає зараз. -->
    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
