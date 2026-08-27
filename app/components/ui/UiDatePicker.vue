<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { errorTextClass, fieldClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

/**
 * Нативний date/datetime-local/time у стилі полів бібліотеки. Власний
 * календар — свідомо ні: він тягне за собою сотні рядків позиціонування,
 * клавіатури й i18n, а нативний пікер уже вміє все це мовою пристрою.
 */
const props = withDefaults(
  defineProps<{
    /** Значення у форматі нативного поля: `YYYY-MM-DD` (для datetime — RFC). */
    modelValue?: string | null
    /** Рід поля. */
    type?: 'date' | 'datetime-local' | 'time'
    /** Видимий лейбл. Пов'язується з полем автоматично. */
    label?: string
    placeholder?: string
    size?: FieldSize
    disabled?: boolean
    readonly?: boolean
    required?: boolean
    /** Мінімальна дата/час у тому ж форматі. */
    min?: string
    /** Максимальна дата/час. */
    max?: string
    /** Текст помилки. Сама його наявність вмикає стан помилки. */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    name?: string
  }>(),
  {
    type: 'date',
    label: undefined,
    placeholder: undefined,
    size: 'md',
    disabled: false,
    readonly: false,
    required: false,
    min: undefined,
    max: undefined,
    error: undefined,
    hint: undefined,
    name: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

defineSlots<Record<string, never>>()

const generatedId = useId()
const inputId = computed(() => props.name ?? `${generatedId}-date`)
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`

const hasError = computed(() => !!props.error)

// aria-describedby вказує рівно на один активний опис — як в UiInput.
const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  return undefined
})
</script>

<template>
  <div>
    <label v-if="label" :for="inputId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <input
      :id="inputId"
      :type="type"
      :value="modelValue ?? ''"
      :name="name"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :class="fieldClass(size, { error: hasError, disabled })"
      :aria-invalid="hasError || undefined"
      :aria-describedby="describedBy"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value || null)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>