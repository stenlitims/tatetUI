<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { errorTextClass, fieldClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

/**
 * Редагування на місці: текст у таблиці/картці, який перетворюється на
 * поле з подвійним кліком (або кліком — залежно від activateOn). Джерело
 * патерну — три реалізації InlineEdit у tatet-cms (Author/Number/Date),
 * зведені в один компонент.
 */
const props = withDefaults(
  defineProps<{
    /** Значення. Використовуйте через `v-model`. */
    modelValue?: string | number | null
    /**
     * Тип редагування. `text` — довільний рядок, `number` — число з
     * валідацією NaN, `date` — нативне date-поле (формат `YYYY-MM-DD`).
     */
    type?: 'text' | 'number' | 'date'
    /** Порожнє значення — що показувати, коли нічого не введено. */
    emptyText?: string
    placeholder?: string
    /**
     * Зберігати на blur — звична поведінка рядків таблиць. `false` —
     * зберігати лише по Enter/кліку поза полем (Enter → commit,
     * Escape → cancel у будь-якому разі).
     */
    saveOnBlur?: boolean
    /** Текст помилки валідації споживача. Ховає кнопку збереження. */
    error?: string
    /** Доступна назва. Обов'язкова — кнопка без тексту. */
    ariaLabel?: string
  }>(),
  {
    emptyText: '—',
    placeholder: 'Введіть значення',
    saveOnBlur: true,
    error: undefined,
    ariaLabel: 'Редагувати',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  /** Редагування почалось. */
  edit: []
  /** Зміну підтверджено. */
  save: [value: string | number | null]
  /** Редагування скасовано — значення не змінилось. */
  cancel: []
}>()

defineSlots<{
  /** Власний рендер відображуваного значення. */
  display?: (props: { value: string | number | null }) => unknown
}>()

const editing = ref(false)
const draft = ref<string | number | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelValue,
  (value) => {
    if (!editing.value) draft.value = value ?? null
  },
  { immediate: true },
)

const displayText = computed(() =>
  props.modelValue == null || props.modelValue === '' ? props.emptyText : String(props.modelValue),
)

async function startEdit() {
  editing.value = true
  draft.value = props.modelValue ?? null
  // Фокус і виділення — після монтування input.
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
}

function commit() {
  if (!editing.value) return
  let value: string | number | null = draft.value
  if (props.type === 'number') {
    if (typeof value === 'string') value = value.trim() === '' ? null : Number(value)
    if (value != null && !Number.isFinite(value)) return // NaN не емітовимо
  } else if (typeof value === 'string' && value.trim() === '') {
    value = null
  }
  editing.value = false
  emit('update:modelValue', value)
  emit('save', value)
}

function cancel() {
  if (!editing.value) return
  editing.value = false
  draft.value = props.modelValue ?? null
  emit('cancel')
}

function onBlur() {
  if (props.saveOnBlur) commit()
  else cancel()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    cancel()
    inputEl.value?.blur()
  }
}
</script>

<template>
  <input
    v-if="editing"
    ref="inputEl"
    :value="draft ?? ''"
    :type="type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'"
    :placeholder="placeholder"
    :class="fieldClass('sm', { error: !!error, extra: 'h-8 md:h-8' })"
    :aria-label="ariaLabel"
    :aria-invalid="!!error || undefined"
    @input="draft = ($event.target as HTMLInputElement).value"
    @keydown="onKeydown"
    @blur="onBlur"
  />
  <button
    v-else
    type="button"
    class="inline-flex min-h-11 w-full cursor-text items-center rounded-control px-1.5 text-left transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0 md:py-0.5"
    :title="'Клікніть, щоб редагувати'"
    :aria-label="`${ariaLabel}: ${displayText}`"
    @click="startEdit"
  >
    <slot name="display" :value="modelValue ?? null">
      <span :class="modelValue == null ? 'text-muted' : 'text-ink'">{{ displayText }}</span>
    </slot>
  </button>

  <p v-if="error && editing" :class="errorTextClass" role="alert">{{ error }}</p>
</template>
