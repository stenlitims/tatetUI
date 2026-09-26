<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch } from 'vue'
import { dropdownPanelStyle, listenViewportChanges, observePanelSize } from '~/utils/overlayPosition'
import {
  dropdownEmptyClass,
  dropdownPanelClass,
  dropdownTransitionProps,
  errorTextClass,
  fieldShellClass,
  fieldTextSizes,
  helperTextClass,
  itemClass,
  itemHighlighted,
  labelClass,
  splitFieldAttrs,
  touchTargetClass,
  type FieldSize,
} from '~/utils/uiFieldStyles'

// class/style — на обгортку, решта атрибутів — на поле вводу міток.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Мітки. Використовуйте через `v-model`. */
    modelValue: string[]
    /**
     * Підказки для панелі. Порожньо — панелі немає взагалі, лишається
     * чистий вільний ввід.
     */
    suggestions?: string[]
    /**
     * Максимальна кількість міток. Досягнувши межі, поле стає лише для
     * читання: нове не додається, але Backspace і далі прибирає мітки.
     */
    max?: number
    /** Максимальна довжина однієї мітки. */
    maxLength?: number
    /**
     * Символи, що завершують мітку і ділять вставлений текст. Enter
     * завершує мітку завжди й у цей список не входить.
     */
    delimiters?: string[]
    /** Дозволити однакові мітки. Типово дублікат відхиляється через `reject`. */
    allowDuplicates?: boolean
    /**
     * Нормалізація перед додаванням — обрізання, нижній регістр, зняття «#».
     * Порожній результат скасовує додавання.
     */
    normalize?: (raw: string) => string
    /** Додавати недописану мітку при втраті фокуса. */
    addOnBlur?: boolean
    /** Висота поля й розмір міток. На мобільному кожен розмір вищий за десктопний. */
    size?: FieldSize
    /** Текст помилки. Стан помилки вмикає САМА наявність тексту. */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    label?: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    id?: string
    name?: string
  }>(),
  {
    suggestions: () => [],
    delimiters: () => [',', ';'],
    allowDuplicates: false,
    addOnBlur: true,
    size: 'md',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  add: [tag: string]
  remove: [tag: string, index: number]
  reject: [tag: string, reason: 'duplicate' | 'max' | 'length' | 'empty']
}>()

defineSlots<{
  /** Власний рендер мітки. `remove` прибирає саме цю мітку. */
  tag?: (props: { tag: string; index: number; remove: () => void }) => unknown
  /** Власний рендер підказки в панелі. */
  suggestion?: (props: { suggestion: string; highlighted: boolean }) => unknown
  /** Показується, коли під запит немає підказок. */
  empty?: () => unknown
}>()

const attrs = useAttrs()
const fieldAttrs = computed(() => splitFieldAttrs(attrs))

const generatedId = useId()
const inputId = computed(() => props.id || `${generatedId}-tags`)
const listboxId = `${generatedId}-suggestions`
const hintId = computed(() => (props.hint && !props.error ? `${inputId.value}-hint` : undefined))
const errorId = computed(() => (props.error ? `${inputId.value}-error` : undefined))
// Рівно один опис.
const describedBy = computed(() => errorId.value ?? hintId.value)

const hasError = computed(() => !!props.error)
const rootEl = ref<HTMLElement | null>(null)
const fieldEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)

const query = ref('')
const isOpen = ref(false)
const highlighted = ref(0)
const announcement = ref('')

/*
 * Backspace на порожньому полі не видаляє одразу.
 *
 * Перше натискання лише «зводить» останню мітку — вона отримує видимий
 * стан «зараз зникне». Друге видаляє. Без цього кроку один зайвий Backspace
 * під час швидкого набору мовчки з'їдає мітку, і помітно це вже після
 * збереження форми.
 */
const armedForRemoval = ref(false)

const isFull = computed(() => typeof props.max === 'number' && props.modelValue.length >= props.max)

const filteredSuggestions = computed(() => {
  if (!props.suggestions.length) return []
  const needle = query.value.trim().toLowerCase()
  return props.suggestions
    .filter((item) => props.allowDuplicates || !props.modelValue.includes(item))
    .filter((item) => !needle || item.toLowerCase().includes(needle))
    .slice(0, 20)
})

const showPanel = computed(() => isOpen.value && !!props.suggestions.length && !isFull.value)

function normalize(raw: string): string {
  const trimmed = props.normalize ? props.normalize(raw) : raw.trim()
  return trimmed
}

/**
 * Додає ПАКЕТ міток за одне оновлення моделі.
 *
 * Вставка «a, b, a, c» у поле, де вже є «a», з max=3 має додати «b»,
 * спинитись на межі й повідомити про це ОДИН раз. Логіка «на кожне
 * натискання» тут не годиться: вона дала б чотири події і напівзастосований
 * масив.
 */
function commit(rawList: string[]) {
  const next = [...props.modelValue]
  let added = 0
  let rejectedMax = false

  for (const raw of rawList) {
    const tag = normalize(raw)
    if (!tag) {
      if (raw.trim()) emit('reject', raw, 'empty')
      continue
    }
    if (typeof props.maxLength === 'number' && tag.length > props.maxLength) {
      emit('reject', tag, 'length')
      continue
    }
    if (!props.allowDuplicates && next.includes(tag)) {
      emit('reject', tag, 'duplicate')
      continue
    }
    if (typeof props.max === 'number' && next.length >= props.max) {
      rejectedMax = true
      break
    }
    next.push(tag)
    emit('add', tag)
    added += 1
  }

  if (rejectedMax) emit('reject', rawList.at(-1) ?? '', 'max')
  if (added) emit('update:modelValue', next)

  /*
   * Межу теж озвучуємо: на ній поле стає readonly, і без пояснення
   * скрінрідер-користувач чує лише, що набір раптом перестав працювати.
   */
  if (added || rejectedMax) {
    const parts: string[] = []
    if (added) parts.push(added === 1 ? `Додано ${next.at(-1)}` : `Додано міток: ${added}`)
    if (typeof props.max === 'number' && next.length >= props.max) parts.push(`досягнуто межі в ${props.max}`)
    announcement.value = parts.join(', ')
  }
  return added
}

function removeAt(index: number) {
  const tag = props.modelValue[index]
  if (tag === undefined) return
  const next = props.modelValue.filter((_, position) => position !== index)
  emit('update:modelValue', next)
  emit('remove', tag, index)
  announcement.value = `Видалено ${tag}`
  armedForRemoval.value = false
}

function splitRaw(raw: string): string[] {
  if (!props.delimiters.length) return [raw]
  const pattern = new RegExp(`[${props.delimiters.map((d) => `\\${d}`).join('')}]`)
  return raw.split(pattern)
}

function commitQuery() {
  if (!query.value.trim()) return
  if (commit(splitRaw(query.value))) query.value = ''
  else query.value = ''
}

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  armedForRemoval.value = false
  // Роздільник усередині введеного — завершує мітку одразу.
  if (props.delimiters.some((delimiter) => raw.includes(delimiter))) {
    const parts = splitRaw(raw)
    const tail = parts.pop() ?? ''
    commit(parts)
    query.value = tail
    ;(event.target as HTMLInputElement).value = tail
  } else {
    query.value = raw
  }
  isOpen.value = true
  highlighted.value = 0
}

function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!props.delimiters.some((delimiter) => text.includes(delimiter))) return
  event.preventDefault()
  commit(splitRaw(text))
  query.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    const picked = showPanel.value ? filteredSuggestions.value[highlighted.value] : undefined
    if (picked) {
      commit([picked])
      query.value = ''
    } else {
      commitQuery()
    }
    return
  }

  if (event.key === 'Backspace' && !query.value) {
    if (!props.modelValue.length) return
    event.preventDefault()
    if (armedForRemoval.value) removeAt(props.modelValue.length - 1)
    else armedForRemoval.value = true
    return
  }

  armedForRemoval.value = false

  if (event.key === 'ArrowDown' && showPanel.value) {
    event.preventDefault()
    highlighted.value = (highlighted.value + 1) % Math.max(filteredSuggestions.value.length, 1)
  } else if (event.key === 'ArrowUp' && showPanel.value) {
    event.preventDefault()
    const total = Math.max(filteredSuggestions.value.length, 1)
    highlighted.value = (highlighted.value - 1 + total) % total
  } else if (event.key === 'Escape' && isOpen.value) {
    event.stopPropagation()
    isOpen.value = false
  }
}

function onBlur() {
  if (props.addOnBlur) commitQuery()
  armedForRemoval.value = false
  isOpen.value = false
}

/* ------------------------------------------------------------------ */
/*  Позиція панелі                                                    */
/* ------------------------------------------------------------------ */

const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const anchor = fieldEl.value
  if (!anchor || typeof window === 'undefined') return
  panelStyle.value = dropdownPanelStyle(anchor, panelEl.value)
}

/*
 * Поле РОСТЕ: мітки переносяться на новий рядок, і висота тригера
 * змінюється, поки панель відкрита. Слухати лише scroll і resize вікна
 * недостатньо — панель відклеїлася б від поля тієї ж миті, коли мітка
 * перейшла на наступний рядок. Панель теж міняє висоту на кожен символ
 * запиту, а visualViewport повідомляє про клавіатуру, що виїхала.
 */
let fieldObserver: ResizeObserver | null = null
let stopViewport: (() => void) | null = null
let stopPanelSize: (() => void) | null = null

function detachReposition() {
  fieldObserver?.disconnect()
  fieldObserver = null
  stopViewport?.()
  stopViewport = null
  stopPanelSize?.()
  stopPanelSize = null
}

watch(showPanel, async (open) => {
  if (!open) {
    detachReposition()
    return
  }
  await nextTick()
  updatePosition()
  stopViewport ??= listenViewportChanges(updatePosition)
  if (typeof ResizeObserver !== 'undefined' && fieldEl.value && !fieldObserver) {
    fieldObserver = new ResizeObserver(updatePosition)
    fieldObserver.observe(fieldEl.value)
  }
})

watch(panelEl, (panel) => {
  stopPanelSize?.()
  stopPanelSize = panel ? observePanelSize(panel, updatePosition) : null
})

onBeforeUnmount(detachReposition)

/*
 * Teleport вмикається лише після монтування. Перевірка
 * `typeof document` прямо в setup справджується вже під час гідратації: клієнт
 * малював Teleport там, де сервер лишив коментар, і Vue сипав «Hydration
 * node mismatch», зсуваючи сусідні вузли.
 */
const teleportReady = ref(false)
onMounted(() => {
  teleportReady.value = true
})

/*
 * Розміри складеного поля: мінімальна висота обгортки — як у fieldClass
 * (45px на телефоні, md: — десктопні), шрифт інпута — 16px на телефоні
 * (інакше iOS зумує), мітки — дрібніші за текст поля.
 */
const TAG_FIELD_SIZES: Record<FieldSize, { shell: string; input: string; chip: string }> = {
  sm: { shell: 'min-h-12 gap-1 px-1.5 py-1 md:min-h-8', input: `py-0.5 ${fieldTextSizes.sm}`, chip: 'px-1.5 py-0.5 text-xs' },
  md: { shell: 'min-h-12 gap-1.5 px-2 py-1.5 md:min-h-9', input: `py-1 ${fieldTextSizes.md}`, chip: 'px-2 py-1 text-xs' },
  lg: { shell: 'min-h-13 gap-1.5 px-2.5 py-2 md:min-h-10', input: `py-1 ${fieldTextSizes.lg}`, chip: 'px-2.5 py-1 text-sm' },
}

const fieldWrapperClass = computed(() => [
  'flex flex-wrap items-center',
  TAG_FIELD_SIZES[props.size].shell,
  fieldShellClass({ error: hasError.value, disabled: props.disabled }),
])

defineExpose({
  /** Ставить фокус на поле вводу. */
  focus: () => inputEl.value?.focus(),
  /** Прибирає всі мітки одним оновленням моделі. */
  clear: () => {
    if (props.modelValue.length) emit('update:modelValue', [])
  },
})
</script>

<template>
  <div ref="rootEl" v-bind="fieldAttrs.root">
    <label v-if="label" :for="inputId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div ref="fieldEl" :class="fieldWrapperClass" @click="inputEl?.focus()">
      <!--
        Мітки — це список уже ухвалених значень, а НЕ вибір зі списку, тож
        role="listbox" тут був би неправдою. До того ж кожна мітка містить
        кнопку видалення, а role="option" забороняє інтерактивних нащадків:
        кнопка стала б недосяжною в режимі читання.
      -->
      <ul v-if="modelValue.length" class="contents">
        <li v-for="(tag, index) in modelValue" :key="`${tag}-${index}`" class="contents">
          <slot name="tag" :tag="tag" :index="index" :remove="() => removeAt(index)">
            <span
              class="inline-flex items-center gap-1 rounded-full border font-medium transition-colors"
              :class="[
                TAG_FIELD_SIZES[size].chip,
                armedForRemoval && index === modelValue.length - 1
                  ? 'border-danger-line bg-danger-bg text-danger'
                  : 'border-line bg-subtle text-ink',
              ]"
            >
              {{ tag }}
              <button
                type="button"
                :class="[
                  'relative -mr-1 flex h-5 w-5 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger-bg hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  touchTargetClass,
                ]"
                :aria-label="`Видалити ${tag}`"
                :disabled="disabled"
                @click.stop="removeAt(index)"
              >
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
                </svg>
              </button>
            </span>
          </slot>
        </li>
      </ul>

      <!--
        На межі max поле стає readonly, а не disabled: disabled викидав фокус
        просто з-під пальців (і клавіатура втрачала місце), а Backspace для
        видалення мітки переставав працювати. v-bind останнім — атрибут
        споживача перемагає, як у звичайному fallthrough.
      -->
      <input
        :id="inputId"
        ref="inputEl"
        type="text"
        role="combobox"
        :value="query"
        :placeholder="modelValue.length ? '' : placeholder"
        :disabled="disabled"
        :readonly="isFull"
        :aria-expanded="showPanel"
        :aria-controls="showPanel ? listboxId : undefined"
        aria-autocomplete="list"
        :aria-activedescendant="showPanel && filteredSuggestions.length ? `${listboxId}-${highlighted}` : undefined"
        :aria-required="required || undefined"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        class="min-w-24 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:ring-0"
        :class="TAG_FIELD_SIZES[size].input"
        v-bind="fieldAttrs.control"
        @input="onInput"
        @paste="onPaste"
        @keydown="onKeydown"
        @focus="isOpen = true"
        @blur="onBlur"
      >
    </div>

    <!-- Форма отримує МІТКИ, по інпуту на кожну — як у UiMultiSelect. Раніше
         name стояв на полі вводу, і сабміт віддавав недописаний текст. -->
    <template v-if="name">
      <input
        v-for="(tag, index) in modelValue"
        :key="`${tag}-${index}`"
        type="hidden"
        :name="name"
        :value="tag"
      >
    </template>

    <Teleport v-if="teleportReady" to="body">
      <Transition v-bind="dropdownTransitionProps">
        <ul
          v-if="showPanel"
          :id="listboxId"
          ref="panelEl"
          role="listbox"
          :aria-label="label || 'Підказки'"
          :class="dropdownPanelClass"
          :style="panelStyle"
        >
          <li
            v-for="(suggestion, index) in filteredSuggestions"
            :id="`${listboxId}-${index}`"
            :key="suggestion"
            role="option"
            :aria-selected="index === highlighted"
            :class="[itemClass(size), index === highlighted ? itemHighlighted : '']"
            @mousedown.prevent="commit([suggestion]); query = ''"
            @mouseenter="highlighted = index"
          >
            <slot name="suggestion" :suggestion="suggestion" :highlighted="index === highlighted">
              {{ suggestion }}
            </slot>
          </li>
          <li v-if="!filteredSuggestions.length" :class="dropdownEmptyClass">
            <slot name="empty">Нічого не знайдено</slot>
          </li>
        </ul>
      </Transition>
    </Teleport>

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>

    <!-- Додавання й видалення інакше нечутні: фокус лишається в полі, і
         зміна списку міток для скрінрідера не відбувається взагалі. -->
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>
