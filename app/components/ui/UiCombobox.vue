<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  ref,
  shallowRef,
  useAttrs,
  useId,
  watch,
} from 'vue'
import UiDrawer from './UiDrawer.vue'
import { dropdownPanelStyle, listenViewportChanges, observePanelSize } from '~/utils/overlayPosition'
import {
  revealSheetItem,
  sheetEmptyClass,
  sheetItemClass,
  sheetItemHighlighted,
  sheetListClass,
  sheetSearchBarClass,
  sheetSearchInputClass,
  sheetTitleFor,
  watchSelectSheet,
} from '~/utils/selectSheet'
import {
  clearButtonClass,
  dropdownEmptyClass,
  dropdownPanelClass,
  dropdownTransitionProps,
  errorTextClass,
  fieldClass,
  helperTextClass,
  itemClass,
  itemHighlighted,
  itemSelected,
  labelClass,
  splitFieldAttrs,
  type FieldSize,
} from '~/utils/uiFieldStyles'

// class/style — на обгортку, решта атрибутів — на поле-комбобокс.
defineOptions({ inheritAttrs: false })

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
    /**
     * Підпис поточного значення, поки його немає серед `options` — форма
     * редагування до першого пошуку. Далі назву обраного компонент пам'ятає
     * сам, навіть коли наступний пошук її вже не повертає.
     */
    selectedLabel?: string
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
    /**
     * Не емітити `search`, доки запит коротший. 0 — емітити все. Короткий
     * запит лише ховає панель — набраний текст лишається в полі.
     */
    minChars?: number
    /** Дозволяє скинути вибір хрестиком. */
    clearable?: boolean
    /** Стабільний DOM id. `name` використовується лише для форми. */
    id?: string
    /**
     * На вузькому екрані (до 768px) пошук і результати відкриваються нижнім
     * sheet'ом на всю ширину замість випадайки під полем.
     */
    mobileSheet?: boolean
  }>(),
  {
    placeholder: 'Пошук…',
    size: 'md',
    disabled: false,
    loading: false,
    minChars: 0,
    clearable: true,
    mobileSheet: true,
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

const attrs = useAttrs()
const fieldAttrs = computed(() => splitFieldAttrs(attrs))

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
// Користувач править текст і ще не обрав: поки так, синхронізація з
// modelValue не має права переписати його запит.
const isTyping = ref(false)
const highlightedIndex = ref(-1)
const teleportReady = shallowRef(false)

/*
 * Sheet-режим (вузький екран). Поле в ньому — кнопка без клавіатури, запит
 * набирається в sheet'і (sheetQuery): поле під фоном і далі показує назву
 * обраного, а не недописаний пошук.
 */
const narrowScreen = shallowRef(false)
const sheetMode = computed(() => props.mobileSheet && narrowScreen.value)
const sheetQuery = ref('')
const sheetTitle = ref('')
const sheetKeyboard = ref(false)
// Останній запит, відданий споживачу: на відкритті порожнього sheet'а
// його треба скинути, інакше список лишився б відфільтрованим старим
// запитом, якого в полі пошуку вже не видно.
let lastSearch = ''

// Запит закороткий — список не показуємо зовсім, навіть «нічого не знайдено».
const sheetQueryTooShort = computed(() => sheetQuery.value.length < props.minChars)

const hasError = computed(() => !!props.error)
const hasValue = computed(
  () => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '',
)

const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  return undefined
})

/*
 * Останній відомий пункт для поточного значення.
 *
 * `options` тут — результати ПОТОЧНОГО пошуку, а не довідник. Поки назва
 * бралася лише з них, новий пошук без обраного пункту (набрав «Льв», коли
 * обрано «Київ») стирав поле на Esc, Tab чи кліку поза ним: значення
 * лишалося 'kyiv', а поле показувало плейсхолдер і ховало хрестик.
 */
const rememberedOption = shallowRef<ComboboxOption | null>(null)

const selectedOption = computed<ComboboxOption | null>(() => {
  if (!hasValue.value) return null
  return (
    props.options.find((option) => option.value === props.modelValue) ??
    (rememberedOption.value?.value === props.modelValue ? rememberedOption.value : null)
  )
})

watch(
  selectedOption,
  (option) => {
    if (option) rememberedOption.value = option
  },
  { immediate: true },
)

const selectedText = computed(
  () => selectedOption.value?.label ?? (hasValue.value ? (props.selectedLabel ?? '') : ''),
)

/* ---------------------------------------------------------------- */
/*  Позиціонування телепортованої панелі — як в UiSelect            */
/* ---------------------------------------------------------------- */

const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const anchor = inputEl.value
  if (!anchor) return
  panelStyle.value = dropdownPanelStyle(anchor, dropdownEl.value)
}

/*
 * Прокрутка будь-якого контейнера (capture — scroll не спливає), resize і
 * visualViewport: екранна клавіатура, що виїхала вже після відкриття,
 * інакше накривала б нижні пункти. Плюс розмір самої панелі — список
 * міняє висоту під час фільтрації чи підвантаження.
 */
let stopViewport: (() => void) | null = null
let stopPanelSize: (() => void) | null = null

function attachReposition() {
  stopViewport ??= listenViewportChanges(updatePosition)
}

function detachReposition() {
  stopViewport?.()
  stopViewport = null
  stopPanelSize?.()
  stopPanelSize = null
}

watch(dropdownEl, (panel) => {
  stopPanelSize?.()
  stopPanelSize = panel ? observePanelSize(panel, updatePosition) : null
})

/* ---------------------------------------------------------------- */
/*  Відкриття / закриття                                            */
/* ---------------------------------------------------------------- */

async function open(fromKeyboard = false) {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  const selectedIndex = props.options.findIndex((option) => option.value === props.modelValue)
  highlightedIndex.value =
    selectedIndex >= 0 && !props.options[selectedIndex]?.disabled
      ? selectedIndex
      : firstEnabledIndex(props.options)
  if (sheetMode.value) {
    sheetQuery.value = ''
    sheetKeyboard.value = fromKeyboard
    sheetTitle.value = sheetTitleFor(inputEl.value, props.label, attrs['aria-label'], undefined)
    if (lastSearch && props.minChars === 0) emitSearch('')
    await nextTick()
    revealSheetItem(optionEls.value[highlightedIndex.value], 'center')
    return
  }
  attachReposition()
  await nextTick()
  updatePosition()
  // Друге вимірювання: панель уже має реальну висоту — фліп точніший.
  await nextTick()
  updatePosition()
  scrollHighlightedIntoView()
}

/** Ховає панель, НЕ чіпаючи набраний текст. */
function hidePanel() {
  if (!isOpen.value) return
  isOpen.value = false
  highlightedIndex.value = -1
  detachReposition()
}

/** Закриття як скасування правки: текст повертається до назви обраного. */
function close() {
  hidePanel()
  isTyping.value = false
  sheetQuery.value = ''
  syncQueryToSelection()
}

// Поворот екрана чи ресайз із відкритою панеллю — закриваємо (див. UiSelect).
watch(sheetMode, () => close())

function emitSearch(value: string) {
  lastSearch = value
  emit('search', value)
}

function syncQueryToSelection() {
  query.value = selectedText.value
}

watch(
  [() => props.modelValue, selectedText],
  () => {
    if (!isTyping.value) syncQueryToSelection()
  },
  { immediate: true },
)

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
  // ДО emit: споживач нерідко чистить options одразу після вибору.
  rememberedOption.value = option
  emit('update:modelValue', option.value)
  const fromSheet = sheetMode.value
  close()
  // Із sheet'а фокус на поле повертає його пастка фокуса.
  if (!fromSheet) inputEl.value?.focus()
}

function clear() {
  emit('update:modelValue', null)
  rememberedOption.value = null
  isTyping.value = false
  query.value = ''
  inputEl.value?.focus()
}

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value
  isTyping.value = true
  highlightedIndex.value = firstEnabledIndex(props.options)
  /*
   * Запит коротший за minChars лише ХОВАЄ панель. Поки тут стояв close(),
   * він ще й повертав текст до назви обраного — і перша ж літера після
   * кліку в поле (клік відкриває панель) стиралася просто під пальцем.
   */
  if (query.value.length < props.minChars) {
    hidePanel()
    return
  }
  emitSearch(query.value)
  if (!isOpen.value) void open()
}

function onSheetInput(event: Event) {
  sheetQuery.value = (event.target as HTMLInputElement).value
  highlightedIndex.value = firstEnabledIndex(props.options)
  if (!sheetQueryTooShort.value) emitSearch(sheetQuery.value)
}

/*
 * Клік у поле лише відкриває панель. Перемикач тут закривав відкриту
 * панель на кліку, яким користувач лише переставляв каретку, — разом із
 * набраним запитом. Мишею закривають шевроном або кліком поза полем.
 */
function onFieldPointerDown() {
  // Sheet відкривається на click (див. UiSelect): інакше фон з'являвся під
  // пальцем ще до того, як дотик завершився.
  if (sheetMode.value) return
  if (!isOpen.value) void open()
}

function onFieldClick() {
  if (sheetMode.value) void open()
}

// mousedown.prevent у шаблоні: фокус лишається в полі, а не падає на <body>.
function onChevronMouseDown() {
  if (props.disabled) return
  if (isOpen.value) return close()
  inputEl.value?.focus()
  void open()
}

/* ---------------------------------------------------------------- */
/*  Клавіатура                                                      */
/* ---------------------------------------------------------------- */

function scrollHighlightedIntoView() {
  const el = optionEls.value[highlightedIndex.value]
  if (sheetMode.value) revealSheetItem(el, 'nearest')
  else el?.scrollIntoView({ block: 'nearest' })
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
  // У sheet-режимі поле — кнопка: стрілки, Enter і пробіл відкривають sheet.
  if (sheetMode.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      void open(true)
    }
    return
  }
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
      // Панель могла сховатися через minChars, а недописаний текст лишився:
      // Escape скасовує і його.
      if (!isOpen.value && !isTyping.value) return
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

/*
 * Клавіатура в sheet'і: фокус на полі пошуку, пункти — через
 * aria-activedescendant. Escape лишаємо стеку оверлеїв UiDrawer.
 */
function onSheetKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      sheetKeyboard.value = true
      return moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
    case 'Enter': {
      event.preventDefault()
      const option = props.options[highlightedIndex.value]
      if (option && !props.loading && !sheetQueryTooShort.value) selectOption(option)
    }
  }
}

function onSheetToggle(value: boolean) {
  if (!value) close()
}

/* ---------------------------------------------------------------- */
/*  Клік поза межами: перевіряємо і корінь, і телепортовану панель  */
/* ---------------------------------------------------------------- */

function onDocumentPointerDown(event: PointerEvent) {
  // Sheet закривається сам — тапом по фону, свайпом чи хрестиком.
  if (sheetMode.value) return
  // isTyping — і тоді, коли панель схована через minChars: недописаний
  // запит без вибору не має лишатися в полі після кліку деінде.
  if (!isOpen.value && !isTyping.value) return
  const target = event.target as Node
  if (rootEl.value?.contains(target)) return
  if (dropdownEl.value?.contains(target)) return
  close()
}

onBeforeUpdate(() => {
  optionEls.value = []
})

let stopSheetWatch: (() => void) | null = null

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  stopSheetWatch = watchSelectSheet((sheet) => {
    narrowScreen.value = sheet
  })
})

onBeforeUnmount(() => {
  stopSheetWatch?.()
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
  <div ref="rootEl" v-bind="fieldAttrs.root">
    <label v-if="label" :for="inputId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <!-- v-bind останнім: атрибут споживача перемагає, як у звичайному fallthrough. -->
      <input
        :id="inputId"
        ref="inputEl"
        :value="query"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :readonly="sheetMode"
        :class="fieldClass(size, {
          error: hasError,
          disabled,
          padRight: clearable && hasValue ? 'pr-14' : 'pr-9',
          extra: 'cursor-default',
        })"
        role="combobox"
        aria-autocomplete="list"
        :aria-haspopup="sheetMode ? 'dialog' : undefined"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        :aria-activedescendant="isOpen && !sheetMode && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        autocomplete="off"
        v-bind="fieldAttrs.control"
        @input="onInput"
        @keydown="onKeydown"
        @pointerdown="onFieldPointerDown"
        @click="onFieldClick"
      />

      <button
        v-if="clearable && hasValue && !disabled"
        type="button"
        :class="['absolute top-1/2 right-8 -translate-y-1/2', clearButtonClass]"
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
      <!-- Шеврон — перемикач мишею: клік у саме поле лише відкриває. -->
      <span
        v-else
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-muted"
        :class="disabled ? 'pointer-events-none' : 'cursor-pointer'"
        aria-hidden="true"
        @mousedown.prevent="onChevronMouseDown"
      >
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
          v-if="isOpen && !sheetMode"
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

    <!--
      Мобільний режим: нижній sheet фіксованої висоти — список під пошуком
      міняється з кожною літерою, і sheet за вмістом стрибав би й ховався
      під клавіатурою. Фокус одразу в пошуку: це автокомпліт, набір тексту
      — єдиний спосіб ним користуватися.
    -->
    <UiDrawer
      v-if="sheetMode"
      :model-value="isOpen"
      position="bottom"
      size="xl"
      :title="sheetTitle"
      initial-focus="[data-sheet-search]"
      close-on-backdrop
      no-padding
      @update:model-value="onSheetToggle"
    >
      <div data-sheet-sticky :class="sheetSearchBarClass">
        <div class="relative">
          <svg
            class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <input
            :value="sheetQuery"
            data-sheet-search
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            :aria-controls="listboxId"
            :aria-activedescendant="highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined"
            :aria-label="sheetTitle || placeholder"
            :placeholder="placeholder"
            enterkeyhint="search"
            autocomplete="off"
            :class="sheetSearchInputClass"
            @input="onSheetInput"
            @keydown="onSheetKeydown"
          />
          <span v-if="loading" class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg class="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.2-10.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </span>
        </div>
      </div>

      <ul :id="listboxId" role="listbox" :aria-label="sheetTitle || undefined" :class="sheetListClass">
        <template v-if="!sheetQueryTooShort">
          <li v-if="loading && !options.length" role="option" aria-disabled="true" :class="sheetEmptyClass">
            Завантаження…
          </li>
          <li
            v-else-if="!options.length && sheetQuery"
            role="option"
            aria-disabled="true"
            :class="sheetEmptyClass"
          >
            Нічого не знайдено
          </li>
          <li
            v-for="(option, index) in options"
            :id="optionId(index)"
            :key="option.value"
            :ref="(el) => (optionEls[index] = el as HTMLElement)"
            role="option"
            :aria-selected="option.value === modelValue"
            :aria-disabled="option.disabled || undefined"
            :class="[
              sheetItemClass,
              sheetKeyboard && index === highlightedIndex ? sheetItemHighlighted : '',
              option.value === modelValue ? itemSelected : '',
              option.disabled ? 'pointer-events-none opacity-50' : '',
            ]"
            @click="selectOption(option)"
          >
            <div class="min-w-0 flex-1">
              <slot
                name="option"
                :option="option"
                :highlighted="sheetKeyboard && index === highlightedIndex"
                :selected="option.value === modelValue"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="truncate">{{ option.label }}</span>
                  <svg
                    v-if="option.value === modelValue"
                    class="h-5 w-5 shrink-0 text-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>
              </slot>
            </div>
          </li>
        </template>
      </ul>
    </UiDrawer>

    <input v-if="name" type="hidden" :name="name" :value="modelValue ?? ''" />

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
