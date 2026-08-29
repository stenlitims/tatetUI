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
import {
  dropdownEmptyClass,
  dropdownPanelClass,
  dropdownSearchInputClass,
  dropdownTransitionProps,
  errorTextClass,
  fieldClass,
  helperTextClass,
  iconClass,
  itemClass,
  itemHighlighted,
  labelClass,
  type FieldSize,
} from '~/utils/uiFieldStyles'
import { orderSelection } from '~/utils/multiSelect'
import { getOverlayChildZIndex } from '~/utils/overlayPosition'

export interface MultiSelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Обрані значення. Використовуйте через `v-model`. */
    modelValue: (string | number)[]
    /**
     * Варіанти вибору. Фільтрація за введеним текстом відбувається
     * локально.
     */
    options: MultiSelectOption[]
    label?: string
    placeholder?: string
    /** Висота поля. На мобільному кожен розмір вищий за десктопний. */
    size?: FieldSize
    disabled?: boolean
    /**
     * Поле пошуку всередині панелі. Для списків ≤5 пунктів не показується
     * навіть із `true` — пошук там лише заважає.
     */
    searchable?: boolean
    /** Скільки обраних підписів показати у тригері, решта згортається в «+N». */
    maxDisplay?: number
    /** Текст помилки. Сама його наявність вмикає стан помилки. */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    /** Стабільний DOM id. `name` використовується лише для форми. */
    id?: string
    name?: string
  }>(),
  {
    placeholder: 'Оберіть',
    size: 'md',
    disabled: false,
    searchable: true,
    maxDisplay: 3,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: (string | number)[]]
}>()

defineSlots<{
  /** Власний рендер пункту списку. */
  option?: (props: {
    option: MultiSelectOption
    highlighted: boolean
    selected: boolean
  }) => unknown
}>()

const generatedId = useId()
const triggerId = computed(() => props.id ?? `${generatedId}-multiselect`)
const listboxId = `${generatedId}-listbox`
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`
const optionId = (index: number) => `${generatedId}-option-${index}`

const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLButtonElement | null>(null)
const dropdownEl = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
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

/*
 * Внутрішня копія значення: панель перемикає пункти миттєво, а в батька
 * йде масив у порядку options (а не в порядку кліків).
 */
const internalValue = ref<(string | number)[]>([...(props.modelValue ?? [])])

watch(
  () => props.modelValue,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(internalValue.value)) {
      internalValue.value = [...(value ?? [])]
    }
  },
)

onBeforeUpdate(() => {
  optionEls.value = []
})

const selectedSet = computed(() => new Set(internalValue.value))

const selectedOptions = computed(() =>
  props.options.filter((option) => selectedSet.value.has(option.value)),
)

const displayText = computed(() => {
  const labels = selectedOptions.value.map((option) => option.label)
  if (labels.length === 0) return props.placeholder
  const head = labels.slice(0, props.maxDisplay).join(', ')
  return labels.length > props.maxDisplay ? `${head} +${labels.length - props.maxDisplay}` : head
})

const filteredOptions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return props.options
  return props.options.filter((option) => option.label.toLowerCase().includes(needle))
})

const showSearch = computed(() => props.searchable && props.options.length > 5)

const triggerClasses = computed(() =>
  fieldClass(props.size, {
    error: hasError.value,
    disabled: props.disabled,
    extra: 'flex cursor-default items-center gap-1.5 text-left pr-9',
  }),
)

/* ---------------------------------------------------------------- */
/*  Позиціонування телепортованої панелі (як в UiSelect)            */
/* ---------------------------------------------------------------- */

const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const anchor = triggerEl.value
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

// capture: подія scroll не спливає — без нього панель висить на місці,
// поки список під нею від'їжджає у внутрішніх контейнерах.
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
  query.value = ''
  highlightedIndex.value = firstEnabledIndex(props.options)
  attachReposition()
  await nextTick()
  updatePosition()
  // Друге вимірювання: перше рахувалося з припущенням 240px і могло
  // помилитися з напрямком фліпу.
  await nextTick()
  updatePosition()
  if (showSearch.value) searchEl.value?.focus()
}

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  highlightedIndex.value = -1
  detachReposition()
}

function toggle() {
  if (props.disabled) return
  if (isOpen.value) close()
  else void open()
}

/* ---------------------------------------------------------------- */
/*  Вибір                                                           */
/* ---------------------------------------------------------------- */

function toggleOption(option: MultiSelectOption) {
  if (option.disabled) return
  const next = new Set(internalValue.value)
  if (next.has(option.value)) next.delete(option.value)
  else next.add(option.value)
  // Віддаємо в порядку options: споживач отримує стабільний масив.
  const ordered = orderSelection(props.options, next)
  internalValue.value = ordered
  emit('update:modelValue', ordered)
}

function selectAll() {
  const merged = new Set(internalValue.value)
  for (const option of filteredOptions.value) {
    if (!option.disabled) merged.add(option.value)
  }
  const ordered = orderSelection(props.options, merged)
  internalValue.value = ordered
  emit('update:modelValue', ordered)
}

function clearAll() {
  // Disabled-значення не змінюємо масовою дією: їх можна лише показати.
  const next = new Set(internalValue.value)
  const candidates = query.value.trim() ? filteredOptions.value : props.options
  for (const option of candidates) {
    if (!option.disabled) next.delete(option.value)
  }
  internalValue.value = orderSelection(props.options, next)
  emit('update:modelValue', [...internalValue.value])
}

/* ---------------------------------------------------------------- */
/*  Клавіатура                                                      */
/* ---------------------------------------------------------------- */

function scrollHighlightedIntoView() {
  optionEls.value[highlightedIndex.value]?.scrollIntoView({ block: 'nearest' })
}

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

function firstEnabledIndex(list: MultiSelectOption[], fromEnd = false) {
  if (fromEnd) {
    for (let index = list.length - 1; index >= 0; index--) {
      if (!list[index]?.disabled) return index
    }
    return -1
  }
  return list.findIndex((option) => !option.disabled)
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!isOpen.value) return void open()
    if (!showSearch.value) {
      const option = filteredOptions.value[highlightedIndex.value]
      if (option) toggleOption(option)
    }
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    if (!isOpen.value) {
      void open().then(() => {
        highlightedIndex.value = firstEnabledIndex(filteredOptions.value, step === -1)
        scrollHighlightedIntoView()
      })
    } else if (!showSearch.value) moveHighlight(step)
  } else if ((event.key === 'Home' || event.key === 'End') && isOpen.value && !showSearch.value) {
    event.preventDefault()
    highlightedIndex.value = firstEnabledIndex(filteredOptions.value, event.key === 'End')
    void nextTick(scrollHighlightedIntoView)
  } else if (event.key === 'Escape' && isOpen.value) {
    event.stopPropagation()
    close()
  }
}

function onSearchKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const list = filteredOptions.value
      if (!list.length) return
      if (highlightedIndex.value === -1) {
        highlightedIndex.value = firstEnabledIndex(list, step === -1)
      }
      else {
        let next = highlightedIndex.value
        for (let i = 0; i < list.length; i++) {
          next = (next + step + list.length) % list.length
          if (!list[next]?.disabled) break
        }
        highlightedIndex.value = next
      }
      void nextTick(scrollHighlightedIntoView)
      return
    }
    case 'Home':
      event.preventDefault()
      if (filteredOptions.value.length) {
        highlightedIndex.value = firstEnabledIndex(filteredOptions.value)
        void nextTick(scrollHighlightedIntoView)
      }
      return
    case 'End':
      event.preventDefault()
      if (filteredOptions.value.length) {
        highlightedIndex.value = firstEnabledIndex(filteredOptions.value, true)
        void nextTick(scrollHighlightedIntoView)
      }
      return
    case 'Enter': {
      event.preventDefault()
      const option = filteredOptions.value[highlightedIndex.value]
      if (option && !option.disabled) toggleOption(option)
      return
    }
    case 'Escape':
      event.stopPropagation()
      close()
      triggerEl.value?.focus()
  }
}

/* ---------------------------------------------------------------- */
/*  Клік поза межами (панель — у body, тож перевіряємо і корінь, і панель) */
/* ---------------------------------------------------------------- */

function onDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value) return
  const target = event.target as Node
  if (rootEl.value?.contains(target)) return
  if (dropdownEl.value?.contains(target)) return
  close()
}

watch(query, () => {
  highlightedIndex.value = firstEnabledIndex(filteredOptions.value)
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
  /** Ставить фокус на тригер. */
  focus: () => triggerEl.value?.focus(),
})
</script>

<template>
  <div ref="rootEl">
    <label v-if="label" :for="triggerId" :class="labelClass">{{ label }}</label>

    <div class="relative">
      <button
        :id="triggerId"
        ref="triggerEl"
        type="button"
        role="combobox"
        :disabled="disabled"
        :class="triggerClasses"
        aria-haspopup="listbox"
        :aria-expanded="isOpen"
        :aria-controls="isOpen ? listboxId : undefined"
        :aria-activedescendant="
          isOpen && !showSearch && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined
        "
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        @click="toggle"
        @keydown="onTriggerKeydown"
      >
        <span class="min-w-0 flex-1 truncate">
          <span v-if="selectedOptions.length === 0" class="text-muted">{{ placeholder }}</span>
          <template v-else>{{ displayText }}</template>
        </span>
        <span
          v-if="selectedOptions.length > 0"
          class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-solid px-1 text-[10px] font-semibold leading-none text-accent-contrast"
        >
          {{ selectedOptions.length }}
        </span>
      </button>

      <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
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
          <div v-if="showSearch" class="border-b border-line p-1.5">
            <input
              ref="searchEl"
              v-model="query"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              :aria-controls="listboxId"
              :aria-activedescendant="highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined"
              aria-label="Пошук опцій"
              placeholder="Пошук…"
              :class="dropdownSearchInputClass"
              @keydown="onSearchKeydown"
            />
          </div>

          <div class="flex items-center justify-between border-b border-line px-2 py-1">
            <div class="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Вибрати все"
                class="rounded-control p-1 text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="selectAll"
              >
                <svg :class="iconClass(size)" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Зняти все"
                class="rounded-control p-1 text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="clearAll"
              >
                <svg :class="iconClass(size)" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 9l-6 6M9 9l6 6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
            <span class="text-[10px] tabular-nums text-muted">
              {{ selectedOptions.length }}/{{ options.length }}
            </span>
          </div>

          <ul
            :id="listboxId"
            role="listbox"
            aria-multiselectable="true"
            class="scrollbar-thin max-h-52 overflow-y-auto py-1"
          >
            <li
              v-if="filteredOptions.length === 0"
              role="option"
              aria-disabled="true"
              :class="dropdownEmptyClass"
            >
              Нічого не знайдено
            </li>
            <template v-else>
              <li
                v-for="(option, index) in filteredOptions"
                :id="optionId(index)"
                :key="option.value"
                :ref="(el) => (optionEls[index] = el as HTMLElement)"
                role="option"
                :aria-selected="selectedSet.has(option.value)"
                :aria-disabled="option.disabled || undefined"
                :class="[
                  itemClass(size),
                  index === highlightedIndex ? itemHighlighted : '',
                  option.disabled ? 'pointer-events-none opacity-50' : '',
                ]"
                @click="!option.disabled && toggleOption(option)"
                @mouseenter="!option.disabled && (highlightedIndex = index)"
              >
                <slot
                  name="option"
                  :option="option"
                  :highlighted="index === highlightedIndex"
                  :selected="selectedSet.has(option.value)"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.25rem] border transition-colors"
                      :class="
                        selectedSet.has(option.value)
                          ? 'border-accent-solid bg-accent-solid'
                          : 'border-line-strong bg-input'
                      "
                    >
                      <svg
                        v-if="selectedSet.has(option.value)"
                        class="h-3 w-3 text-accent-contrast"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                        />
                      </svg>
                    </div>
                    <span class="truncate">{{ option.label }}</span>
                  </div>
                </slot>
              </li>
            </template>
          </ul>
        </div>
      </Transition>
    </Teleport>

    <template v-if="name">
      <input
        v-for="value in internalValue"
        :key="`${name}-${value}`"
        type="hidden"
        :name="name"
        :value="value"
      />
    </template>

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
