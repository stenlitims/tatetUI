<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { errorTextClass, fieldClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

/**
 * Редагування на місці: текст у таблиці/картці, який перетворюється на
 * поле з подвійним кліком (або кліком — залежно від activateOn). Джерело
 * патерну — три незалежні реалізації InlineEdit (Author/Number/Date),
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
const displayEl = ref<HTMLButtonElement | null>(null)
const errorId = `${useId()}-error`

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
  if (editing.value) return
  editing.value = true
  draft.value = props.modelValue ?? null
  emit('edit')
  // Фокус і виділення — після монтування input.
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
}

function restoreDisplayFocus() {
  void nextTick(() => displayEl.value?.focus())
}

/*
 * «Те саме значення» з урахуванням того, що в полі завжди рядок: 5 і «5»
 * для текстового поля — одне й те саме, а '' і null — обидва «порожньо».
 */
function isUnchanged(value: string | number | null) {
  const current = props.modelValue === '' ? null : (props.modelValue ?? null)
  if (value === current) return true
  if (value === null || current === null) return false
  return props.type !== 'number' && String(value) === String(current)
}

function commit(restoreFocus = false) {
  if (!editing.value || props.error) return
  let value: string | number | null = draft.value
  if (props.type === 'number') {
    if (typeof value === 'string') value = value.trim() === '' ? null : Number(value)
    if (value != null && !Number.isFinite(value)) return // NaN не емітовимо
  } else if (typeof value === 'string' && value.trim() === '') {
    value = null
  }
  /*
   * Незмінене значення — це скасування, а не збереження. Інакше таблиця,
   * що шле PATCH на `save`, робила запит щоразу, коли користувач просто
   * клацнув у комірку й пішов (saveOnBlur типово ввімкнений).
   */
  if (isUnchanged(value)) {
    cancel(restoreFocus)
    return
  }
  editing.value = false
  emit('update:modelValue', value)
  emit('save', value)
  if (restoreFocus) restoreDisplayFocus()
}

function cancel(restoreFocus = false) {
  if (!editing.value) return
  editing.value = false
  draft.value = props.modelValue ?? null
  emit('cancel')
  if (restoreFocus) restoreDisplayFocus()
}

function onBlur() {
  if (props.saveOnBlur) commit(false)
  else cancel(false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit(true)
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    cancel(true)
  }
}
</script>

<template>
  <!-- Один корінь: з двома (поле/кнопка + помилка) Vue не мав куди покласти
       class чи data-* споживача й лише попереджав у консоль. -->
  <div class="min-w-0">
    <input
      v-if="editing"
      ref="inputEl"
      :value="draft ?? ''"
      :type="type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'"
      :placeholder="placeholder"
      :class="fieldClass('sm', { error: !!error, extra: 'h-8 md:h-8' })"
      :aria-label="ariaLabel"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error ? errorId : undefined"
      @input="draft = ($event.target as HTMLInputElement).value"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <button
      v-else
      ref="displayEl"
      type="button"
      class="group inline-flex min-h-12 w-full cursor-text items-center gap-2 rounded-control px-1.5 text-left text-base transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0 md:py-1 md:text-sm"
      :title="'Клікніть, щоб редагувати'"
      :aria-label="`${ariaLabel}: ${displayText}`"
      @click="startEdit"
    >
      <span class="min-w-0 flex-1">
        <slot name="display" :value="modelValue ?? null">
          <span :class="modelValue == null ? 'text-muted' : 'text-ink'">{{ displayText }}</span>
        </slot>
      </span>
      <!-- Олівець проявляється на наведенні й фокусі: без нього текст, який
           можна редагувати, нічим не відрізняється від того, який не можна. -->
      <svg
        class="h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
        <path d="m13.5 6.5 3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>

    <p v-if="error && editing" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
  </div>
</template>
