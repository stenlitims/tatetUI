<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import UiCalendar from '~/components/ui/UiCalendar.vue'
import {
  compareDay,
  defaultDateRangePresets,
  isSameDay,
  startOfDay,
  type DateRangePreset,
} from '~/utils/calendar'
import { computeAnchoredPanelPosition, getOverlayChildZIndex } from '~/utils/overlayPosition'
import {
  dropdownTransitionProps,
  errorTextClass,
  fieldClass,
  helperTextClass,
  labelClass,
  type FieldSize,
} from '~/utils/uiFieldStyles'

export interface DateRange {
  /** Початок періоду включно. */
  start: Date
  /** Кінець періоду включно. */
  end: Date
}

const props = withDefaults(
  defineProps<{
    /**
     * Обраний період або `null`. Через `v-model`.
     *
     * Об'єкт, а не кортеж: `range.start` у шаблоні читається, `range[0]` —
     * ні. Половинчастого стану тут не буває: поки другий кінець невідомий,
     * модель лишається попередньою.
     */
    modelValue?: DateRange | null
    /** Пресети ліворуч від календаря. Порожній масив ховає колонку. */
    presets?: DateRangePreset[]
    /** Найраніша доступна дата включно. */
    min?: Date
    /** Найпізніша доступна дата включно. */
    max?: Date
    /** Які дати недоступні. Проксується в `UiCalendar`. */
    disabledDate?: (date: Date) => boolean
    /** Формат періоду в тригері. */
    displayFormat?: 'short' | 'long'
    /** Хрестик, що скидає період. */
    clearable?: boolean
    /** Закривати панель, щойно обрано обидва кінці. */
    autoClose?: boolean
    /** Куди відкривати панель відносно поля. */
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
    /** Перший день тижня. `1` — понеділок (uk). */
    weekStartsOn?: 0 | 1
    /** Локаль підписів. */
    locale?: string
    /** Що вважати «сьогодні» — для детермінізму прередеру й тестів. */
    today?: Date
    /** Висота поля. На мобільному кожен розмір вищий за десктопний. */
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
    modelValue: null,
    presets: () => defaultDateRangePresets,
    displayFormat: 'short',
    clearable: true,
    autoClose: true,
    placement: 'bottom-start',
    weekStartsOn: 1,
    locale: 'uk-UA',
    size: 'md',
    placeholder: 'Оберіть період',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: DateRange | null]
  presetSelect: [preset: DateRangePreset]
  open: []
  close: []
}>()

defineSlots<{
  /** Власний тригер. `text` — уже відформатований період або плейсхолдер. */
  trigger?: (props: { open: boolean; toggle: () => void; text: string; clear: () => void }) => unknown
  /** Власний рендер пресету. */
  preset?: (props: { preset: DateRangePreset; active: boolean }) => unknown
  /** Рядок під календарем: «Скасувати», «Застосувати». */
  footer?: (props: { close: () => void }) => unknown
}>()

const generatedId = useId()
const fieldId = computed(() => props.id || `${generatedId}-range`)
const panelId = `${generatedId}-panel`
const hintId = computed(() => (props.hint && !props.error ? `${fieldId.value}-hint` : undefined))
const errorId = computed(() => (props.error ? `${fieldId.value}-error` : undefined))
const describedBy = computed(() => errorId.value ?? hintId.value)

const hasError = computed(() => !!props.error)
const isOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLButtonElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)

const todayDate = computed(() => startOfDay(props.today ?? new Date()))

/* ------------------------------------------------------------------ */
/*  Кількість місяців                                                 */
/* ------------------------------------------------------------------ */

/*
 * Два місяці ставимо ЛИШЕ на десктопі, і рахує це JS, а не `md:hidden`.
 *
 * Прихований класом другий місяць лишається в DOM — це 42 зайві gridcell
 * для скрінрідера і, головне, ДРУГИЙ елемент із tabindex="0", який руйнує
 * roving tabindex першого. Типове значення — 1: прередер віддає мобільний
 * варіант, і найвужчий клієнт отримує розмітку без стрибка.
 */
const isWide = ref(false)
let wideQuery: MediaQueryList | null = null

function syncWide(event?: MediaQueryListEvent) {
  isWide.value = event?.matches ?? wideQuery?.matches ?? false
}

onMounted(() => {
  if (typeof window.matchMedia !== 'function') return
  wideQuery = window.matchMedia('(min-width: 768px)')
  syncWide()
  wideQuery.addEventListener('change', syncWide)
})

const monthsShown = computed<1 | 2>(() => (isWide.value ? 2 : 1))

/* ------------------------------------------------------------------ */
/*  Форматування                                                      */
/* ------------------------------------------------------------------ */

const shortFormatter = computed(() =>
  new Intl.DateTimeFormat(props.locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
)
const longFormatter = computed(() =>
  new Intl.DateTimeFormat(props.locale, { day: 'numeric', month: 'long', year: 'numeric' }),
)

const triggerText = computed(() => {
  const range = props.modelValue
  if (!range) return props.placeholder
  const format = props.displayFormat === 'long' ? longFormatter.value : shortFormatter.value
  if (isSameDay(range.start, range.end)) return format.format(range.start)
  return `${format.format(range.start)} – ${format.format(range.end)}`
})

/* ------------------------------------------------------------------ */
/*  Пресети                                                           */
/* ------------------------------------------------------------------ */

/*
 * Пресет, що не влазить у min/max, не показуємо взагалі. Запропонувати
 * «Останні 30 днів», коли min — десять днів тому, означає запропонувати
 * період, який сам календар відхилить.
 */
const availablePresets = computed(() =>
  props.presets.filter((preset) => {
    const [start, end] = preset.range(todayDate.value)
    if (props.min && compareDay(start, props.min) < 0) return false
    if (props.max && compareDay(end, props.max) > 0) return false
    return true
  }),
)

function isActivePreset(preset: DateRangePreset) {
  const range = props.modelValue
  if (!range) return false
  const [start, end] = preset.range(todayDate.value)
  return isSameDay(range.start, start) && isSameDay(range.end, end)
}

function applyPreset(preset: DateRangePreset) {
  const [start, end] = preset.range(todayDate.value)
  emit('update:modelValue', { start, end })
  emit('presetSelect', preset)
  if (props.autoClose) close()
}

/* ------------------------------------------------------------------ */
/*  Календар                                                          */
/* ------------------------------------------------------------------ */

// UiCalendar працює з кортежем — конверсія в один рядок в обидва боки.
const calendarValue = computed<[Date, Date] | null>(() =>
  props.modelValue ? [props.modelValue.start, props.modelValue.end] : null,
)

function onCalendarChange(value: Date | [Date, Date] | null) {
  if (!Array.isArray(value)) return
  emit('update:modelValue', { start: value[0], end: value[1] })
  if (props.autoClose) close()
}

function clear() {
  emit('update:modelValue', null)
}

/* ------------------------------------------------------------------ */
/*  Панель                                                            */
/* ------------------------------------------------------------------ */

const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const anchor = triggerEl.value
  if (!anchor || typeof window === 'undefined') return
  const rect = anchor.getBoundingClientRect()
  const point = computeAnchoredPanelPosition(
    rect,
    { width: panelEl.value?.offsetWidth || 320, height: panelEl.value?.offsetHeight || 360 },
    { width: window.innerWidth, height: window.innerHeight },
    props.placement,
  )
  panelStyle.value = {
    top: `${Math.round(point.top)}px`,
    left: `${Math.round(point.left)}px`,
    zIndex: String(getOverlayChildZIndex(anchor)),
  }
}

function open() {
  if (props.disabled) return
  isOpen.value = true
  emit('open')
}

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  emit('close')
}

function toggle() {
  isOpen.value ? close() : open()
}

watch(isOpen, async (value) => {
  if (!value) {
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
    return
  }
  await nextTick()
  updatePosition()
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
})

/*
 * Панель немодальна — тієї самої родини, що UiPopover і UiMenu. Пастки
 * фокуса тут навмисно немає: вона зламала б Tab до наступного поля форми.
 * Закриття — по виході фокуса за межі тригера й панелі.
 */
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next) return
  if (rootEl.value?.contains(next) || panelEl.value?.contains(next)) return
  close()
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (rootEl.value?.contains(target) || panelEl.value?.contains(target)) return
  close()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    close()
    triggerEl.value?.focus()
  }
}

const teleportReady = ref(false)
onMounted(() => {
  teleportReady.value = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  wideQuery?.removeEventListener('change', syncWide)
  if (typeof document === 'undefined') return
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})

const triggerClasses = computed(() =>
  fieldClass(props.size, {
    error: hasError.value,
    disabled: props.disabled,
    // Кнопка очищення з'являється поверх правого краю — під неї потрібне
    // місце, і воно має пережити md-брейкпоінт (див. fieldClass).
    padRight: props.clearable && props.modelValue ? 'pr-10' : undefined,
    extra: 'text-left flex items-center gap-2',
  }),
)

defineExpose({
  /** Відкриває панель. */
  open,
  /** Закриває панель. */
  close,
  /** Ставить фокус на тригер. */
  focus: () => triggerEl.value?.focus(),
})
</script>

<template>
  <div ref="rootEl" @focusout="onFocusOut">
    <label v-if="label" :for="fieldId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <slot name="trigger" :open="isOpen" :toggle="toggle" :text="triggerText" :clear="clear">
      <div class="relative">
        <button
          :id="fieldId"
          ref="triggerEl"
          type="button"
          :disabled="disabled"
          :aria-haspopup="'dialog'"
          :aria-expanded="isOpen"
          :aria-controls="isOpen ? panelId : undefined"
          :aria-invalid="hasError || undefined"
          :aria-describedby="describedBy"
          :class="triggerClasses"
          @click="toggle"
        >
          <svg class="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2" />
            <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span class="truncate" :class="modelValue ? 'text-ink' : 'text-muted'">{{ triggerText }}</span>
        </button>

        <button
          v-if="clearable && modelValue && !disabled"
          type="button"
          class="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Очистити період"
          @click="clear"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </slot>

    <input v-if="name" type="hidden" :name="name" :value="modelValue ? `${modelValue.start.toISOString()}/${modelValue.end.toISOString()}` : ''">

    <Teleport v-if="teleportReady" to="body">
      <Transition v-bind="dropdownTransitionProps">
        <div
          v-if="isOpen"
          :id="panelId"
          ref="panelEl"
          role="dialog"
          :aria-label="label || 'Вибір періоду'"
          class="fixed rounded-overlay border border-line bg-dropdown p-3 shadow-overlay"
          :style="panelStyle"
        >
          <div class="flex flex-col gap-3 md:flex-row">
            <!--
              Нижче md пресети стають смугою НАД сіткою: колонка 160px поруч
              із місяцем 300px не влазить у 375px екрана.
            -->
            <div
              v-if="availablePresets.length"
              class="flex gap-1.5 overflow-x-auto pb-1 md:w-40 md:shrink-0 md:flex-col md:overflow-visible md:border-r md:border-line md:pb-0 md:pr-3"
            >
              <button
                v-for="preset in availablePresets"
                :key="preset.label"
                type="button"
                class="shrink-0 whitespace-nowrap rounded-control px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full"
                :class="isActivePreset(preset) ? 'bg-primary-50 font-medium text-accent' : 'text-ink hover:bg-hover'"
                @click="applyPreset(preset)"
              >
                <slot name="preset" :preset="preset" :active="isActivePreset(preset)">
                  {{ preset.label }}
                </slot>
              </button>
            </div>

            <UiCalendar
              mode="range"
              :model-value="calendarValue"
              :months="monthsShown"
              :min="min"
              :max="max"
              :disabled-date="disabledDate"
              :week-starts-on="weekStartsOn"
              :locale="locale"
              :today="today"
              aria-label="Вибір періоду"
              @update:model-value="onCalendarChange"
            />
          </div>

          <div v-if="$slots.footer" class="mt-3 border-t border-line pt-3">
            <slot name="footer" :close="close" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <p v-if="error" :id="errorId" :class="errorTextClass">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
