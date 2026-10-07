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
import { dropdownPanelStyle, listenViewportChanges, observePanelSize } from '~/utils/overlayPosition'
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

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Обране значення. Використовуйте через `v-model`. */
    modelValue?: string | number | null
    /**
     * Варіанти вибору. Фільтрація за введеним текстом відбувається
     * локально.
     */
    options: SelectOption[]
    label?: string
    placeholder?: string
    /** Висота поля. На мобільному кожен розмір вищий за десктопний. */
    size?: FieldSize
    disabled?: boolean
    required?: boolean
    /** Показує індикатор замість списку — для серверного пошуку. */
    loading?: boolean
    /** Текст помилки. Його наявність вмикає стан помилки. */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    /** Дозволяє скинути вибір хрестиком. */
    clearable?: boolean
    /**
     * Дозволяє звужувати список набором тексту. Без фільтра поле поводиться
     * як нативний `<select>`: Enter і пробіл відкривають список.
     */
    filterable?: boolean
    /** Стабільний DOM id. `name` використовується лише для форми. */
    id?: string
    name?: string
  }>(),
  { size: 'md', filterable: true },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  /** Введений текст пошуку. Підключайте для серверної фільтрації. */
  search: [query: string]
}>()

defineSlots<{
  /** Власний рендер пункту списку. */
  option?: (props: { option: SelectOption; highlighted: boolean; selected: boolean }) => unknown
}>()

const attrs = useAttrs()
const fieldAttrs = computed(() => splitFieldAttrs(attrs))

const generatedId = useId()
const inputId = computed(() => props.id ?? `${generatedId}-select`)
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
const isTyping = ref(false)
const highlightedIndex = ref(-1)
const teleportReady = shallowRef(false)

const hasError = computed(() => !!props.error)

const selectedOption = computed(
  () => props.options.find((option) => option.value === props.modelValue) ?? null,
)

const filteredOptions = computed(() => {
  // Поки користувач не почав набирати, показуємо ВЕСЬ список. Інакше після
  // відкриття видно лише один пункт — той, що вже обраний і чия назва
  // стоїть у полі як текст фільтра.
  if (!props.filterable || !isTyping.value || !query.value) return props.options
  const needle = query.value.toLowerCase()
  return props.options.filter((option) => option.label.toLowerCase().includes(needle))
})

const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  return undefined
})

const inputClasses = computed(() =>
  fieldClass(props.size, {
    error: hasError.value,
    disabled: props.disabled,
    // Очищення додає другу іконку праворуч — місця треба вдвічі більше.
    padRight: props.clearable && selectedOption.value ? 'pr-14' : 'pr-9',
    // text-ellipsis: довга назва обраного пункту (пристрій, компанія) обрізається
    // «…», а не рубається посеред літери; під час набору фільтра не діє.
    extra: 'cursor-default text-ellipsis',
  }),
)

/* ---------------------------------------------------------------- */
/*  Позиціонування телепортованої панелі                            */
/* ---------------------------------------------------------------- */

const panelStyle = ref<Record<string, string>>({})

/**
 * Рахуємо позицію самі, без @floating-ui і без VueUse: компонент має
 * копіюватись у чужий проєкт без жодної нової залежності.
 */
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

async function open() {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  isTyping.value = false
  const selectedIndex = filteredOptions.value.findIndex(
    (option) => option.value === props.modelValue,
  )
  highlightedIndex.value =
    selectedIndex >= 0 && !filteredOptions.value[selectedIndex]?.disabled
      ? selectedIndex
      : firstEnabledIndex(filteredOptions.value)
  attachReposition()
  await nextTick()
  updatePosition()
  // Друге вимірювання після того, як панель отримала реальну висоту:
  // перше рахувалося з припущенням 240px і могло помилитись із фліпом.
  await nextTick()
  updatePosition()
  scrollHighlightedIntoView()
}

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  isTyping.value = false
  highlightedIndex.value = -1
  detachReposition()
  syncQueryToSelection()
}

function syncQueryToSelection() {
  query.value = selectedOption.value?.label ?? ''
}

/*
 * Стежимо і за значенням, і за НАЗВОЮ обраного пункту. Форма редагування
 * зазвичай отримує значення раніше за список опцій — поки тут був лише
 * modelValue, поле лишалося порожнім, доки користувач не відкриє й не
 * закриє його. Під час набору не чіпаємо: підвантаження опцій переписало б
 * запит просто під пальцями.
 */
watch(
  [() => props.modelValue, () => selectedOption.value?.label],
  () => {
    if (!isTyping.value) syncQueryToSelection()
  },
  { immediate: true },
)

watch(filteredOptions, (options) => {
  if (!isOpen.value) return
  const current = options[highlightedIndex.value]
  if (current && !current.disabled) return
  highlightedIndex.value = firstEnabledIndex(options)
})

function selectOption(option: SelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  close()
  inputEl.value?.focus()
}

function clear() {
  emit('update:modelValue', null)
  isTyping.value = false
  query.value = ''
  inputEl.value?.focus()
}

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value
  // open() скидає isTyping, тож відкриваємо ДО позначки набору. У зворотному
  // порядку перша літера, набрана в закрите поле, не фільтрувала список, а
  // Enter обирав перший пункт повного списку, а не знайдений.
  if (!isOpen.value) void open()
  isTyping.value = true
  highlightedIndex.value = firstEnabledIndex(filteredOptions.value)
  emit('search', query.value)
}

/*
 * Клік у поле лише ВІДКРИВАЄ список. Поки тут був перемикач, клік усередині
 * відкритого поля — просто щоб переставити каретку — закривав список і
 * стирав набраний запит. Закрити мишею можна шевроном, кліком поза полем
 * чи вибором. Без фільтра поле — по суті кнопка, тож там клік перемикає.
 */
function onFieldPointerDown() {
  if (!isOpen.value) void open()
  else if (!props.filterable) close()
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
  el?.scrollIntoView({ block: 'nearest' })
}

/** Наступний недеактивований пункт у заданому напрямку. */
function moveHighlight(step: 1 | -1) {
  const list = filteredOptions.value
  if (!list.length) return
  let next = highlightedIndex.value
  for (let i = 0; i < list.length; i++) {
    next = (next + step + list.length) % list.length
    if (!list[next]?.disabled) break
  }
  highlightedIndex.value = next
  void nextTick(scrollHighlightedIntoView)
}

function firstEnabledIndex(list: SelectOption[], fromEnd = false) {
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
      if (!isOpen.value) {
        // Без фільтра — як нативний <select>: Enter відкриває список. Поле з
        // фільтром лишає Enter на закритому полі формі (сабміт).
        if (!props.filterable) {
          event.preventDefault()
          void open()
        }
        return
      }
      event.preventDefault()
      const option = filteredOptions.value[highlightedIndex.value]
      if (option) selectOption(option)
      return
    }
    case ' ': {
      // У полі з фільтром пробіл — частина запиту.
      if (props.filterable) return
      event.preventDefault()
      if (!isOpen.value) return void open()
      const option = filteredOptions.value[highlightedIndex.value]
      if (option) selectOption(option)
      return
    }
    case 'Escape':
      if (!isOpen.value) return
      // stopPropagation: інакше той самий Escape закриє ще й модалку, у
      // якій цей селект стоїть.
      event.stopPropagation()
      close()
      return
    case 'Home':
      if (!isOpen.value) return
      event.preventDefault()
      highlightedIndex.value = firstEnabledIndex(filteredOptions.value)
      return void nextTick(scrollHighlightedIntoView)
    case 'End':
      if (!isOpen.value) return
      event.preventDefault()
      highlightedIndex.value = firstEnabledIndex(filteredOptions.value, true)
      return void nextTick(scrollHighlightedIntoView)
    case 'Tab':
      close()
  }
}

/*
 * Клік поза межами. Перевіряємо і корінь, і телепортовану панель: панель
 * лежить у <body>, тобто формально поза коренем компонента, і перевірка
 * лише по кореню закривала б список на кліку по його ж пункту.
 */
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
        :readonly="!filterable"
        :class="inputClasses"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        :aria-activedescendant="isOpen && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        autocomplete="off"
        v-bind="fieldAttrs.control"
        @input="onInput"
        @keydown="onKeydown"
        @pointerdown="onFieldPointerDown"
      />

      <button
        v-if="clearable && selectedOption && !disabled"
        type="button"
        :class="['absolute top-1/2 right-8 -translate-y-1/2', clearButtonClass]"
        @click="clear"
      >
        <span class="sr-only">Очистити вибір</span>
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <!-- Шеврон — єдиний перемикач мишею: клік у саме поле лише відкриває. -->
      <span
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
          v-if="isOpen"
          ref="dropdownEl"
          :class="dropdownPanelClass"
          :style="panelStyle"
        >
          <ul :id="listboxId" role="listbox" class="py-1">
            <li v-if="loading" role="option" aria-disabled="true" :class="dropdownEmptyClass">
              Завантаження…
            </li>
            <li
              v-else-if="!filteredOptions.length"
              role="option"
              aria-disabled="true"
              :class="dropdownEmptyClass"
            >
              Нічого не знайдено
            </li>
            <li
              v-for="(option, index) in loading ? [] : filteredOptions"
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
