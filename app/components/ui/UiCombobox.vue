<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  ref,
  shallowRef,
  useId,
  watch,
} from 'vue'
import { getOverlayChildZIndex } from '~/utils/overlayPosition'
import {
  dropdownEmptyClass,
  dropdownPanelClass,
  dropdownTransitionProps,
  errorTextClass,
  fieldClass,
  helperTextClass,
  iconClass,
  itemClass,
  itemHighlighted,
  itemSelected,
  labelClass,
  type FieldSize,
} from '~/utils/uiFieldStyles'

export interface ComboboxOption {
  value: string | number
  label: string
  disabled?: boolean
}

/**
 * Async-пошук: компонент НЕ фільтрує локально — панель показує рівно те,
 * що споживач поклав в options. Подвійна фільтрація (тут + сервером)
 * ховає валідні матчі. Ввід емітує `search`, решта — на споживачі.
 */
const props = withDefaults(
  defineProps<{
    /** Обране значення. Використовуйте через `v-model`. */
    modelValue?: string | number | null
    /**
     * Поточні варіанти. Компонент їх НЕ фільтрує: список приходить із
     * сервера у відповідь на подію `search`.
     */
    options: ComboboxOption[]
    label?: string
    placeholder?: string
    /** Висота поля. На мобільному кожен розмір вищий за десктопний. */
    size?: FieldSize
    disabled?: boolean
    required?: boolean
    /** Керований стан завантаження — панель показує «Завантаження…». */
    loading?: boolean
    /** Текст помилки. Сама його наявність вмикає стан помилки. */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    name?: string
    /** Не емітити `search`, доки запит коротший. 0 — емітити все. */
    minChars?: number
    /** Дозволяє скинути вибір хрестиком. */
    clearable?: boolean
    /** Стабільний DOM id. `name` використовується лише для форми. */
    id?: string
  }>(),
  {
    placeholder: 'Пошук…',
    size: 'md',
    disabled: false,
    loading: false,
    minChars: 0,
    clearable: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  /** Введений текст. Споживач дебаунить і фетчить сам. */
  search: [query: string]
}>()

defineSlots<{
  /** Власний рендер пункту списку. */
  option?: (props: { option: ComboboxOption; highlighted: boolean; selected: boolean }) => unknown
}>()

const generatedId = useId()
const inputId = computed(() => props.id ?? `${generatedId}-combobox`)
const listboxId = `${generatedId}-listbox`
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`
const optionId = (index: number) => `${generatedId}-option-${index}`

const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const dropdownEl = ref<HTMLElement | null>(null)
const optionEls = ref<(HTMLElement | null)[]>([])

const isOpen = ref(false)
const query = ref('')
const highlightedIndex = ref(-1)
const teleportReady = shallowRef(false)

const hasError = computed(() => !!props.error)

const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  return undefined
})

const selectedOption = computed(
  () => props.options.find((option) => option.value === props.modelValue) ?? null,
)

/* ---------------------------------------------------------------- */
/*  Позиціонування телепортованої панелі — як в UiSelect            */
/* ---------------------------------------------------------------- */

const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const anchor = inputEl.value
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const margin = 4
  const needed = dropdownEl.value?.offsetHeight || 240
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  const openBelow = spaceBelow >= needed || spaceBelow >= spaceAbove
  const top = openBelow ? rect.bottom + margin : rect.top - needed - margin

  panelStyle.value = {
    position: 'fixed',
    top: `${Math.max(margin, top)}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: String(getOverlayChildZIndex(anchor)),
  }
}

// capture: подія scroll не спливає — панель мусить їхати за якорем
// усередині будь-яких внутрішніх контейнерів.
function attachReposition() {
  window.addEventListener('scroll', updatePosition, { passive: true, capture: true })
  window.addEventListener('resize', updatePosition, { passive: true })
}

function detachReposition() {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
}

/* ---------------------------------------------------------------- */
/*  Відкриття / закриття                                            */
/* ---------------------------------------------------------------- */

async function open() {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  const selectedIndex = props.options.findIndex((option) => option.value === props.modelValue)
  highlightedIndex.value =
    selectedIndex >= 0 && !props.options[selectedIndex]?.disabled
      ? selectedIndex
      : firstEnabledIndex(props.options)
  attachReposition()
  await nextTick()
  updatePosition()
  // Друге вимірювання: панель уже має реальну висоту — фліп точніший.
  await nextTick()
  updatePosition()
  scrollHighlightedIntoView()
}

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  highlightedIndex.value = -1
  detachReposition()
  syncQueryToSelection()
}

function syncQueryToSelection() {
  query.value = selectedOption.value?.label ?? ''
}

watch(() => props.modelValue, syncQueryToSelection, { immediate: true })

watch(
  () => props.options,
  (options) => {
    if (!isOpen.value) return
    const current = options[highlightedIndex.value]
    if (current && !current.disabled) return
    highlightedIndex.value = firstEnabledIndex(options)
  },
  { deep: true },
)

function selectOption(option: ComboboxOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  close()
  inputEl.value?.focus()
}

function clear() {
  emit('update:modelValue', null)
  query.value = ''
  inputEl.value?.focus()
}

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value
  highlightedIndex.value = firstEnabledIndex(props.options)
  if (query.value.length >= props.minChars) emit('search', query.value)
  // Панель відкривається на ввід лише коли запит достатньо довгий;
  // короткий запит лишає поле чистим для подальшого набору.
  if (query.value.length < props.minChars) {
    close()
    return
  }
  if (!isOpen.value) void open()
}

/* ---------------------------------------------------------------- */
/*  Клавіатура                                                      */
/* ---------------------------------------------------------------- */

function scrollHighlightedIntoView() {
  optionEls.value[highlightedIndex.value]?.scrollIntoView({ block: 'nearest' })
}

function moveHighlight(step: 1 | -1) {
  const list = props.options
  if (!list.length) return
  let next = highlightedIndex.value
  for (let i = 0; i < list.length; i++) {
    next = (next + step + list.length) % list.length
    if (!list[next]?.disabled) break
  }
  highlightedIndex.value = next
  void nextTick(scrollHighlightedIntoView)
}

function firstEnabledIndex(list: ComboboxOption[], fromEnd = false) {
  if (fromEnd) {
    for (let index = list.length - 1; index >= 0; index--) {
      if (!list[index]?.disabled) return index
    }
    return -1
  }
  return list.findIndex((option) => !option.disabled)
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) return void open()
      return moveHighlight(1)
    case 'ArrowUp':
      event.preventDefault()
      if (!isOpen.value) return void open()
      return moveHighlight(-1)
    case 'Enter': {
      if (!isOpen.value) return
      event.preventDefault()
      const option = props.options[highlightedIndex.value]
      if (option) selectOption(option)
      return
    }
    case 'Escape':
      if (!isOpen.value) return
      // stopPropagation: той самий Escape не закриє модалку навколо.
      event.stopPropagation()
      close()
      return
    case 'Home':
      if (!isOpen.value) return
      event.preventDefault()
      highlightedIndex.value = firstEnabledIndex(props.options)
      return void nextTick(scrollHighlightedIntoView)
    case 'End':
      if (!isOpen.value) return
      event.preventDefault()
      highlightedIndex.value = firstEnabledIndex(props.options, true)
      return void nextTick(scrollHighlightedIntoView)
    case 'Tab':
      close()
  }
}

/* ---------------------------------------------------------------- */
/*  Клік поза межами: перевіряємо і корінь, і телепортовану панель  */
/* ---------------------------------------------------------------- */

function onDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value) return
  const target = event.target as Node
  if (rootEl.value?.contains(target)) return
  if (dropdownEl.value?.contains(target)) return
  close()
}

onBeforeUpdate(() => {
  optionEls.value = []
})

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  detachReposition()
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  }
})

defineExpose({
  /** Ставить фокус на поле. */
  focus: () => inputEl.value?.focus(),
})
</script>

<template>
  <div ref="rootEl">
    <label v-if="label" :for="inputId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <input
        :id="inputId"
        ref="inputEl"
        :value="query"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :class="fieldClass(size, {
          error: hasError,
          disabled,
          padRight: clearable && selectedOption ? 'pr-14' : 'pr-9',
          extra: 'cursor-default',
        })"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        :aria-activedescendant="isOpen && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        autocomplete="off"
        @input="onInput"
        @keydown="onKeydown"
        @pointerdown="isOpen ? close() : open()"
      />

      <button
        v-if="clearable && selectedOption && !disabled"
        type="button"
        class="absolute top-1/2 right-8 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="clear"
      >
        <span class="sr-only">Очистити вибір</span>
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <!-- Стан завантаження замінює шеврон: користувач бачить, що пошук живий. -->
      <span v-if="loading" class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg class="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-6.2-10.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </span>
      <span v-else class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
        <svg
          class="h-4 w-4 transition-transform"
          :class="isOpen ? 'rotate-180' : ''"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </span>
    </div>

    <Teleport to="body" :disabled="!teleportReady">
      <Transition v-bind="dropdownTransitionProps">
        <div
          v-if="isOpen"
          ref="dropdownEl"
          :class="dropdownPanelClass"
          :style="panelStyle"
        >
          <ul :id="listboxId" role="listbox" class="py-1">
            <li v-if="loading" role="option" aria-disabled="true" :class="dropdownEmptyClass">
              Завантаження…
            </li>
            <li v-else-if="!options.length" role="option" aria-disabled="true" :class="dropdownEmptyClass">
              Нічого не знайдено
            </li>
            <li
              v-for="(option, index) in loading ? [] : options"
              :id="optionId(index)"
              :key="option.value"
              :ref="(el) => (optionEls[index] = el as HTMLElement)"
              role="option"
              :aria-selected="option.value === modelValue"
              :aria-disabled="option.disabled || undefined"
              :class="[
                itemClass(size),
                index === highlightedIndex ? itemHighlighted : '',
                option.value === modelValue ? itemSelected : '',
                option.disabled ? 'pointer-events-none opacity-50' : '',
              ]"
              @click="selectOption(option)"
              @mouseenter="!option.disabled && (highlightedIndex = index)"
            >
              <slot
                name="option"
                :option="option"
                :highlighted="index === highlightedIndex"
                :selected="option.value === modelValue"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate">{{ option.label }}</span>
                  <svg
                    v-if="option.value === modelValue"
                    class="h-4 w-4 shrink-0 text-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>
              </slot>
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>

    <input v-if="name" type="hidden" :name="name" :value="modelValue ?? ''" />

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
