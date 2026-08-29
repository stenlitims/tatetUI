<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { errorTextClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

const props = withDefaults(
  defineProps<{
    /** Значення поля. Використовуйте через `v-model`. */
    modelValue?: string | null
    label?: string
    placeholder?: string
    /** Кількість видимих рядків у згорнутому стані. */
    rows?: number
    disabled?: boolean
    readonly?: boolean
    required?: boolean
    /** Текст помилки. Його наявність вмикає стан помилки. */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    /**
     * Автоматично росте під вміст замість власної прокрутки.
     *
     * Обмежене `maxRows`: без стелі довгий текст виштовхує кнопку
     * «Надіслати» за межі екрана.
     */
    autoresize?: boolean
    /** Стеля висоти в рядках для `autoresize`. */
    maxRows?: number
    /** Максимальна кількість символів. Передається як нативний `maxlength`. */
    maxLength?: number
    /** Показувати лічильник символів. Працює разом із `maxLength`. */
    showCount?: boolean
    /**
     * Додаткові класи на сам `<textarea>`.
     *
     * Звичайний `class` осідає на кореневому `<div>` разом із лейблом і
     * текстом помилки — це правильно для відступів, але не дає, скажімо,
     * зробити поле моноширинним. Цей проп цілить саме в поле.
     */
    inputClass?: string
    /** Стабільний DOM id. `name` використовується лише для форми. */
    id?: string
    name?: string
  }>(),
  { rows: 4, maxRows: 12, showCount: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

defineSlots<Record<string, never>>()

const generatedId = useId()
const textareaId = computed(() => props.id ?? `${generatedId}-textarea`)
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`
const counterId = `${generatedId}-counter`

const el = ref<HTMLTextAreaElement | null>(null)
const hasError = computed(() => !!props.error)
const normalizedMaxLength = computed(() => {
  const value = props.maxLength
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined
})
const showCounter = computed(() => props.showCount && normalizedMaxLength.value !== undefined)
const characterCount = computed(() => (props.modelValue ?? '').length)

const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  if (showCounter.value) return counterId
  return undefined
})

const classes = computed(() => [
  'w-full rounded-control border bg-input px-3 py-2 text-base text-ink placeholder:text-muted',
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm',
  hasError.value ? 'border-danger focus-visible:ring-danger' : 'border-line focus-visible:border-accent-solid',
  props.disabled ? 'cursor-not-allowed opacity-50' : '',
  props.autoresize ? 'resize-none overflow-y-auto scrollbar-thin' : 'resize-y',
  props.inputClass ?? '',
])

/*
 * Висоту рахуємо в два кроки: спершу скидаємо в 'auto', і лише потім
 * читаємо scrollHeight. Без скидання scrollHeight ніколи не зменшиться —
 * поле росте при видаленні тексту так само, як при додаванні.
 */
function resize() {
  const node = el.value
  if (!node || !props.autoresize) return
  node.style.height = 'auto'
  const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight) || 20
  const styles = getComputedStyle(node)
  const cssNumber = (value: string) => Number.parseFloat(value) || 0
  const padding = cssNumber(styles.paddingTop) + cssNumber(styles.paddingBottom)
  const border = cssNumber(styles.borderTopWidth) + cssNumber(styles.borderBottomWidth)
  const max = lineHeight * Math.max(1, props.maxRows) + padding + border
  node.style.height = `${Math.min(node.scrollHeight, max)}px`
}

watch(
  [() => props.modelValue, () => props.autoresize, () => props.rows, () => props.maxRows],
  () => void nextTick(resize),
)

onMounted(resize)

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  resize()
}

defineExpose({
  /** Ставить фокус на поле. */
  focus: () => el.value?.focus(),
})
</script>

<template>
  <div>
    <label v-if="label" :for="textareaId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <textarea
      :id="textareaId"
      ref="el"
      :value="modelValue ?? ''"
      :rows="rows"
      :name="name"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :maxlength="normalizedMaxLength"
      :class="classes"
      :aria-invalid="hasError || undefined"
      :aria-describedby="describedBy"
      @input="onInput"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />

    <div v-if="error || hint || showCounter" class="flex items-start justify-between gap-3">
      <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
      <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
      <span v-else />
      <p
        v-if="showCounter"
        :id="counterId"
        class="mt-1 shrink-0 text-xs tabular-nums"
        :class="characterCount >= (normalizedMaxLength ?? Infinity) ? 'text-danger' : 'text-muted'"
      >
        {{ characterCount }} / {{ normalizedMaxLength }}
      </p>
    </div>
  </div>
</template>
