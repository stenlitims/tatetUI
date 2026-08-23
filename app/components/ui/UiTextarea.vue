<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
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
    name?: string
  }>(),
  { rows: 4, maxRows: 12 },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

defineSlots<Record<string, never>>()

const generatedId = useId()
const textareaId = computed(() => props.name ?? `${generatedId}-textarea`)
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`

const el = ref<HTMLTextAreaElement | null>(null)
const hasError = computed(() => !!props.error)

const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  return undefined
})

const classes = computed(() => [
  'w-full rounded-control border bg-input px-3 py-2 text-base text-ink placeholder:text-muted',
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm',
  hasError.value ? 'border-danger focus-visible:ring-danger' : 'border-line focus-visible:border-accent-solid',
  props.disabled ? 'cursor-not-allowed opacity-50' : '',
  props.autoresize ? 'resize-none overflow-y-auto scrollbar-thin' : 'resize-y',
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
  const padding = node.offsetHeight - node.clientHeight
  const max = lineHeight * props.maxRows + padding
  node.style.height = `${Math.min(node.scrollHeight, max)}px`
}

watch(() => props.modelValue, () => void nextTick(resize))

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
      :class="classes"
      :aria-invalid="hasError || undefined"
      :aria-describedby="describedBy"
      @input="onInput"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
