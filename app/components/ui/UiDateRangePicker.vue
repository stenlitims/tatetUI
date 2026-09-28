<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, useSlots, watch } from 'vue'
import UiCalendar from '~/components/ui/UiCalendar.vue'
import {
  compareDay,
  defaultDateRangePresets,
  isSameDay,
  startOfDay,
  toDateKey,
  type DateRangePreset,
} from '~/utils/calendar'
import {
  getOverlayChildZIndex,
  getVisibleViewport,
  listenViewportChanges,
  placeAnchoredPanel,
  viewportMaxWidth,
} from '~/utils/overlayPosition'
import {
  clearButtonClass,
  dropdownTransitionProps,
  errorTextClass,
  fieldClass,
  helperTextClass,
  labelClass,
  splitFieldAttrs,
  touchTargetClass,
  type FieldSize,
} from '~/utils/uiFieldStyles'

// class/style — на обгортку, решта атрибутів — на типовий тригер (з власним
// тригером зі слота їм немає куди йти, тож вони лишаються на корені).
defineOptions({ inheritAttrs: false })

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
    /** Ім'я поля форми. Значення — локальні дати `YYYY-MM-DD/YYYY-MM-DD`. */
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

const attrs = useAttrs()
const slots = useSlots()
const fieldAttrs = computed(() => splitFieldAttrs(attrs))
const rootBindings = computed(() => (slots.trigger ? { ...attrs } : fieldAttrs.value.root))
const triggerBindings = computed(() => (slots.trigger ? {} : fieldAttrs.value.control))

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
const calendarEl = ref<InstanceType<typeof UiCalendar> | null>(null)

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

/*
 * Значення для форми — календарні дні за локальним часом. toISOString()
 * переводив локальну опівніч в UTC, і в Києві 24.09 йшло на сервер як
 * `2026-09-23T21:00:00.000Z`, тобто вчорашнім днем.
 */
const formValue = computed(() =>
  props.modelValue ? `${toDateKey(props.modelValue.start)}/${toDateKey(props.modelValue.end)}` : '',
)

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

/*
 * Смуга пресетів на телефоні гортається вбік. Chromium на Tab докручує її
 * лише до пресету, схованого повністю, і то по центру; частково видимий
 * лишає обрізаним. `nearest` разом зі scroll-padding смуги показує його
 * цілим. Лише для фокуса з клавіатури: прокрутка посеред тапу зсунула б
 * пресет з-під пальця.
 */
function onPresetsFocusin(event: FocusEvent) {
  const target = event.target as HTMLElement
  if (target.matches(':focus-visible')) target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
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
  // Хрестик зникає разом зі значенням — без цього фокус падав на <body>.
  focusTrigger()
}

/* ------------------------------------------------------------------ */
/*  Панель                                                            */
/* ------------------------------------------------------------------ */

const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const anchor = triggerEl.value
  if (!anchor || typeof window === 'undefined') return
  const viewport = getVisibleViewport()
  const point = placeAnchoredPanel(anchor.getBoundingClientRect(), panelEl.value, viewport, props.placement, {
    fallback: { width: 320, height: 360 },
  })
  panelStyle.value = {
    top: `${Math.round(point.top)}px`,
    left: `${Math.round(point.left)}px`,
    // Пресети на телефоні — горизонтальна смуга: її max-content (усі
    // пресети в рядок) робив панель 690px завширшки на 375px екрані.
    // Обмеження ширини перетворює смугу на прокручувану, як і задумано.
    maxWidth: viewportMaxWidth(viewport),
    // Над клавіатурою чи в ландшафті місця може не вистачити на місяць
    // цілком — тоді панель прокручується, а не обрізається краєм.
    ...(point.fits ? {} : { maxHeight: `${Math.floor(point.maxHeight)}px`, overflowY: 'auto' }),
    zIndex: String(getOverlayChildZIndex(anchor)),
  }
}

// Власний тригер зі слота не має ref — беремо перший фокусований у корені.
function focusTrigger() {
  const target =
    triggerEl.value ??
    rootEl.value?.querySelector<HTMLElement>('button, [href], input:not([type="hidden"]), [tabindex]:not([tabindex="-1"])')
  target?.focus()
}

function open() {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  emit('open')
}

/**
 * `returnFocus` — повернути фокус на тригер, якщо він був у панелі, яка
 * зараз зникне (інакше він падав на <body>). Клік поза панеллю і вихід
 * фокуса деінде фокус НЕ перехоплюють: користувач уже пішов туди, куди хотів.
 */
function close(returnFocus = true) {
  if (!isOpen.value) return
  const focusWasInside = !!panelEl.value?.contains(document.activeElement)
  isOpen.value = false
  emit('close')
  if (returnFocus && focusWasInside) focusTrigger()
}

function toggle() {
  if (isOpen.value) close()
  else open()
}

/*
 * Панель відкрилася — фокус переходить у календар. Без цього клавіатура
 * до панелі не діставалася зовсім: панель телепортована в кінець <body>,
 * тож Tab із тригера вів до наступного поля форми, а focusout закривав
 * панель. preventScroll — бо в першу мить панель ще не спозиціонована.
 */
let stopViewport: (() => void) | null = null

watch(isOpen, async (value) => {
  if (!value) {
    stopViewport?.()
    stopViewport = null
    return
  }
  await nextTick()
  updatePosition()
  calendarEl.value?.focus({ preventScroll: true })
  stopViewport ??= listenViewportChanges(updatePosition)
})

/*
 * Панель немодальна — тієї самої родини, що UiPopover і UiMenu. Пастки
 * фокуса тут навмисно немає: вона зламала б Tab до наступного поля форми.
 * Закриття — по виході фокуса за межі тригера й панелі. Слухач стоїть і на
 * корені, і на панелі: телепортована панель у DOM лежить поза коренем, і
 * focusout із неї до кореня не спливає.
 */
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next) return
  if (rootEl.value?.contains(next) || panelEl.value?.contains(next)) return
  close(false)
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (rootEl.value?.contains(target) || panelEl.value?.contains(target)) return
  close(false)
}

/*
 * Escape — на самому компоненті, не на document. Слухач на document не міг
 * зупинити слухача UiModal на тому ж document, тож усередині модалки один
 * Escape закривав і панель, і модалку.
 */
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isOpen.value) return
  event.stopPropagation()
  close()
}

/*
 * Tab на краях панелі повертає фокус на тригер. Панель лежить у кінці
 * <body>: Tab з її останнього елемента виводив фокус за межі сторінки.
 * Вперед — без preventDefault: браузер продовжує Tab уже від тригера, тобто
 * до наступного поля форми.
 */
function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') return onEscape(event)
  if (event.key !== 'Tab' || !panelEl.value) return
  const tabbables = [
    ...panelEl.value.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'),
  ].filter((element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled)
  const active = document.activeElement
  if (event.shiftKey ? active !== tabbables[0] : active !== tabbables.at(-1)) return
  if (event.shiftKey) event.preventDefault()
  close()
}

const teleportReady = ref(false)
onMounted(() => {
  teleportReady.value = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  wideQuery?.removeEventListener('change', syncWide)
  if (typeof document === 'undefined') return
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  stopViewport?.()
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
  <div ref="rootEl" v-bind="rootBindings" @focusout="onFocusOut" @keydown="onEscape">
    <label v-if="label" :for="fieldId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <slot name="trigger" :open="isOpen" :toggle="toggle" :text="triggerText" :clear="clear">
      <div class="relative">
        <!-- v-bind останнім: атрибут споживача перемагає, як у звичайному fallthrough. -->
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
          v-bind="triggerBindings"
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
          :class="['absolute right-1.5 top-1/2 -translate-y-1/2', clearButtonClass]"
          aria-label="Очистити період"
          @click="clear"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </slot>

    <input v-if="name" type="hidden" :name="name" :value="formValue">

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
          @keydown="onPanelKeydown"
          @focusout="onFocusOut"
        >
          <div class="flex flex-col gap-3 md:flex-row">
            <!--
              Нижче md пресети стають смугою НАД сіткою: колонка 160px поруч
              із місяцем 300px не влазить у 375px екрана.

              На телефоні смуга — ряд пігулок із межею: голий текст у ряд не
              читався як щось, що можна натиснути, а обрізаний краєм панелі
              останній пресет — як поламаний. Смуга виходить під краї панелі
              (-mx-3 px-3), тож обрізання читається як «далі є ще». py-1
              дає місце невидимій зоні дотику: overflow-x-auto обрізає й
              по вертикалі, і 45px зона h-10 пігулки інакше різалась би.
              scroll-px-3 — той самий відступ від краю панелі, коли фокус
              докручує пресет (onPresetsFocusin).
            -->
            <div
              v-if="availablePresets.length"
              class="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto overscroll-x-contain px-3 py-1 scroll-px-3 md:mx-0 md:w-40 md:shrink-0 md:flex-col md:overflow-visible md:border-r md:border-line md:py-0 md:pl-0 md:pr-3"
              @focusin="onPresetsFocusin"
            >
              <button
                v-for="preset in availablePresets"
                :key="preset.label"
                type="button"
                class="relative h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:h-auto md:w-full md:rounded-control md:border-0 md:px-3 md:py-2"
                :class="[
                  touchTargetClass,
                  isActivePreset(preset)
                    ? 'border-primary-200 bg-primary-50 font-medium text-accent'
                    : 'border-line text-ink hover:bg-hover',
                ]"
                @click="applyPreset(preset)"
              >
                <slot name="preset" :preset="preset" :active="isActivePreset(preset)">
                  {{ preset.label }}
                </slot>
              </button>
            </div>

            <UiCalendar
              ref="calendarEl"
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

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
