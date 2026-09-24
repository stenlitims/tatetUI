<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import {
  addDays,
  addMonths,
  buildMonthGrid,
  clampDate,
  compareDay,
  isSameDay,
  isWithin,
  isoWeekNumber,
  startOfDay,
  startOfMonth,
} from '~/utils/calendar'

const props = withDefaults(
  defineProps<{
    /**
     * Обрана дата (`single`) або діапазон (`range`). Через `v-model`.
     *
     * У режимі `range` НАПІВобраний діапазон назовні не емітиться: перший
     * клік живе у внутрішньому стані, а модель оновлюється лише коли відомі
     * обидва кінці. Тому споживач ніколи не отримує кортеж, який нічого не
     * означає.
     */
    modelValue?: Date | [Date, Date] | null
    /** Одна дата чи діапазон. */
    mode?: 'single' | 'range'
    /** Показаний місяць. Через `v-model:month`. */
    month?: Date
    /** Найраніша доступна дата включно. */
    min?: Date
    /** Найпізніша доступна дата включно. */
    max?: Date
    /**
     * Які дати недоступні. Недоступний день лишається ФОКУСОВНИМ:
     * `aria-disabled`, а не атрибут `disabled` — інакше стрілками
     * неможливо перескочити заблокований тиждень.
     */
    disabledDate?: (date: Date) => boolean
    /** Скільки місяців показати поруч. */
    months?: 1 | 2
    /** Перший день тижня. `1` — понеділок (uk), `0` — неділя. */
    weekStartsOn?: 0 | 1
    /** Колонка номерів тижнів за ISO 8601. */
    showWeekNumbers?: boolean
    /** Показувати числа сусідніх місяців. Приховані лишаються порожніми комірками. */
    showOutsideDays?: boolean
    /** Доступна назва сітки, коли поруч немає видимого заголовка. */
    ariaLabel?: string
    /** Локаль назв місяців і днів тижня. */
    locale?: string
    disabled?: boolean
    /**
     * Що вважати «сьогодні». Існує заради детермінізму: прередер, тест і
     * скріншот мають малювати той самий місяць.
     */
    today?: Date
  }>(),
  {
    mode: 'single',
    months: 1,
    weekStartsOn: 1,
    showOutsideDays: true,
    locale: 'uk-UA',
    ariaLabel: 'Календар',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: Date | [Date, Date] | null]
  'update:month': [value: Date]
}>()

defineSlots<{
  /** Власний рендер дня. Стан приходить готовим — рахувати його вдруге не треба. */
  day?: (props: {
    date: Date
    selected: boolean
    inRange: boolean
    rangeStart: boolean
    rangeEnd: boolean
    today: boolean
    disabled: boolean
    outside: boolean
  }) => unknown
  /** Шапка з навігацією замість стандартної. */
  header?: (props: { month: Date; label: string; previous: () => void; next: () => void }) => unknown
  /** Рядок під сіткою: кнопки «Сьогодні», «Очистити». */
  footer?: () => unknown
}>()

const baseId = useId()
const gridEl = ref<HTMLElement | null>(null)

const todayDate = computed(() => startOfDay(props.today ?? new Date()))

/* ------------------------------------------------------------------ */
/*  Модель                                                            */
/* ------------------------------------------------------------------ */

const selectedSingle = computed(() =>
  props.mode === 'single' && props.modelValue instanceof Date ? props.modelValue : null,
)

const selectedRange = computed<[Date, Date] | null>(() =>
  props.mode === 'range' && Array.isArray(props.modelValue) ? props.modelValue : null,
)

/** Перший клік у режимі діапазону. Назовні не виходить. */
const pendingStart = ref<Date | null>(null)
/** Дата під курсором — для попереднього підсвічування діапазону. */
const hovered = ref<Date | null>(null)

/* ------------------------------------------------------------------ */
/*  Показаний місяць і фокус                                          */
/* ------------------------------------------------------------------ */

function initialMonth(): Date {
  if (props.month) return startOfMonth(props.month)
  if (selectedSingle.value) return startOfMonth(selectedSingle.value)
  if (selectedRange.value) return startOfMonth(selectedRange.value[0])
  return startOfMonth(todayDate.value)
}

const viewMonth = ref(initialMonth())

/** Чи лежить дата у ВЛАСНОМУ місяці однієї з показаних сіток (не як сусідній день). */
function isInView(date: Date) {
  const first = startOfMonth(viewMonth.value)
  const last = addDays(addMonths(first, props.months), -1)
  return compareDay(date, first) >= 0 && compareDay(date, last) <= 0
}

function initialFocus(): Date {
  // Обрана дата — лише якщо вона на екрані: з явним `month` вона могла
  // опинитися в іншому місяці, і сітка лишалася без жодної зупинки Tab.
  for (const candidate of [selectedSingle.value, selectedRange.value?.[0], todayDate.value]) {
    if (candidate && isInView(candidate)) return startOfDay(candidate)
  }
  const first = startOfMonth(viewMonth.value)
  const clamped = clampDate(first, props.min, props.max)
  return isInView(clamped) ? clamped : first
}

const focusedDate = ref(initialFocus())

/*
 * Гортання кнопками чи v-model:month не рухало фокусований день. Щойно він
 * виїжджав за показані місяці, жодна клітинка не мала tabindex="0", і Tab
 * просто перестрибував сітку. Тепер фокус переходить на той самий день
 * місяця в першому показаному (31 → останній день коротшого місяця).
 */
function keepFocusInView() {
  if (isInView(focusedDate.value)) return
  const first = startOfMonth(viewMonth.value)
  const lastDay = addDays(addMonths(first, 1), -1).getDate()
  focusedDate.value = new Date(first.getFullYear(), first.getMonth(), Math.min(focusedDate.value.getDate(), lastDay))
}

watch(() => props.month, (value) => {
  if (!value) return
  viewMonth.value = startOfMonth(value)
  keepFocusInView()
})

function setMonth(next: Date) {
  viewMonth.value = startOfMonth(next)
  emit('update:month', viewMonth.value)
  keepFocusInView()
}

/* ------------------------------------------------------------------ */
/*  Сітка                                                             */
/* ------------------------------------------------------------------ */

const grids = computed(() =>
  Array.from({ length: props.months }, (_, offset) => {
    const month = addMonths(viewMonth.value, offset)
    return { month, days: buildMonthGrid(month, props.weekStartsOn) }
  }),
)

const monthFormatter = computed(() =>
  new Intl.DateTimeFormat(props.locale, { month: 'long', year: 'numeric' }),
)
const dayLabelFormatter = computed(() =>
  new Intl.DateTimeFormat(props.locale, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }),
)

const weekdays = computed(() => {
  // Беремо перший тиждень будь-якої сітки — він уже починається з
  // потрібного дня, тож окремої таблиці назв не треба.
  const week = buildMonthGrid(viewMonth.value, props.weekStartsOn).slice(0, 7)
  const short = new Intl.DateTimeFormat(props.locale, { weekday: 'short' })
  const long = new Intl.DateTimeFormat(props.locale, { weekday: 'long' })
  return week.map((date) => ({ short: short.format(date), long: long.format(date) }))
})

function isOutside(date: Date, month: Date) {
  return date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()
}

function isDisabled(date: Date) {
  if (props.disabled) return true
  if (props.min && compareDay(date, props.min) < 0) return true
  if (props.max && compareDay(date, props.max) > 0) return true
  return props.disabledDate?.(date) ?? false
}

/** Кінець діапазону для підсвічування: або наведена дата, або фокус. */
const previewEnd = computed(() => hovered.value ?? focusedDate.value)

/*
 * Сусідній день може бути зупинкою Tab лише тоді, коли свого місяця цієї
 * дати на екрані немає. З двома місяцями 1–11 жовтня стоять і в хвості
 * вересневої сітки, і в жовтневій: без цього правила було дві зупинки Tab, а
 * стрілки приводили фокус на бляклу копію в лівому місяці.
 */
const focusedInView = computed(() => isInView(focusedDate.value))

function dayState(date: Date, month: Date) {
  const range = selectedRange.value
  const pending = pendingStart.value

  let rangeStart = false
  let rangeEnd = false
  let inRange = false

  if (props.mode === 'range') {
    if (pending) {
      rangeStart = isSameDay(date, pending)
      rangeEnd = previewEnd.value ? isSameDay(date, previewEnd.value) : false
      inRange = previewEnd.value ? isWithin(date, pending, previewEnd.value) : rangeStart
    } else if (range) {
      rangeStart = isSameDay(date, range[0])
      rangeEnd = isSameDay(date, range[1])
      inRange = isWithin(date, range[0], range[1])
    }
  }

  const selected =
    props.mode === 'single'
      ? !!selectedSingle.value && isSameDay(date, selectedSingle.value)
      : inRange

  const outside = isOutside(date, month)

  return {
    date,
    selected,
    inRange,
    rangeStart,
    rangeEnd,
    today: isSameDay(date, todayDate.value),
    disabled: isDisabled(date),
    outside,
    focused: isSameDay(date, focusedDate.value) && (!outside || !focusedInView.value),
  }
}

/*
 * Класи дня рахуються ОДНИМ виразом, а не стосом умовних рядків.
 *
 * Поки в масиві одночасно лежали `text-ink` (звичайний день) і
 * `text-accent-contrast` (обраний), переможця визначав порядок утиліт у
 * згенерованому CSS, а не порядок у масиві. Вигравав `text-ink` — тобто на
 * синій заливці обраного дня у СВІТЛІЙ темі опинявся майже чорний текст із
 * контрастом близько 2,8:1. У темній темі та сама помилка була непомітна,
 * бо `--ink` там світлий.
 */
function dayClass(state: ReturnType<typeof dayState>) {
  const base = 'relative flex h-10 w-10 items-center justify-center text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'

  if (state.disabled) return `${base} cursor-not-allowed text-muted opacity-40`

  // Кінець діапазону або обрана дата — суцільна заливка.
  if (state.rangeStart || state.rangeEnd || (props.mode === 'single' && state.selected)) {
    return `${base} cursor-pointer rounded-control bg-accent-solid text-accent-contrast hover:bg-accent-solid-hover`
  }

  // Середина діапазону — підкладка без заливки.
  if (state.inRange) return `${base} cursor-pointer bg-primary-50 text-accent`

  // Поза діапазоном — заокруглений hover, як у обраної дати: інакше при
  // наведенні клітинка квадратна, а після кліку — кругла, і день «стрибає».
  if (state.outside) return `${base} cursor-pointer rounded-control text-muted opacity-60 hover:bg-hover`
  if (state.today) return `${base} cursor-pointer rounded-control font-semibold text-accent hover:bg-hover`
  return `${base} cursor-pointer rounded-control text-ink hover:bg-hover`
}

function ariaLabelFor(date: Date, state: ReturnType<typeof dayState>) {
  let label = dayLabelFormatter.value.format(date)
  if (state.rangeStart) label += ' — початок періоду'
  if (state.rangeEnd) label += ' — кінець періоду'
  return label
}

/* ------------------------------------------------------------------ */
/*  Вибір                                                             */
/* ------------------------------------------------------------------ */

function select(date: Date) {
  if (isDisabled(date)) return
  const day = startOfDay(date)

  if (props.mode === 'single') {
    emit('update:modelValue', day)
    return
  }

  if (!pendingStart.value) {
    pendingStart.value = day
    return
  }

  // Другий клік раніше за перший — просто перевертаємо кінці.
  const [start, end] = compareDay(pendingStart.value, day) <= 0
    ? [pendingStart.value, day]
    : [day, pendingStart.value]
  pendingStart.value = null
  emit('update:modelValue', [start, end])
}

/* ------------------------------------------------------------------ */
/*  Клавіатура                                                        */
/* ------------------------------------------------------------------ */

async function moveFocus(next: Date) {
  const target = clampDate(next, props.min, props.max)
  focusedDate.value = target

  // Фокус виїхав за показані місяці — гортаємо.
  const firstShown = startOfMonth(viewMonth.value)
  const lastShown = addMonths(firstShown, props.months - 1)
  if (compareDay(target, firstShown) < 0) setMonth(target)
  else if (compareDay(target, addDays(addMonths(lastShown, 1), -1)) > 0) {
    setMonth(addMonths(target, -(props.months - 1)))
  }

  /*
   * Вузол під фокусом щойно перемалювався (а при зміні місяця — створився
   * заново). Без повторного focus() у nextTick фокус падає на <body>, і
   * клавіатурна сесія мовчки обривається.
   */
  await nextTick()
  gridEl.value?.querySelector<HTMLElement>('[data-focused="true"]')?.focus()
}

function onKeydown(event: KeyboardEvent) {
  // Escape скасовує НЕЗАВЕРШЕНИЙ діапазон звідки завгодно в календарі; якщо
  // скасовувати нічого — подія йде далі, щоб закрилася панель, у якій
  // календар лежить.
  if (event.key === 'Escape') {
    if (pendingStart.value) {
      event.stopPropagation()
      pendingStart.value = null
    }
    return
  }

  /*
   * Решта клавіш — лише з клітинки дня. Слухач стоїть на корені, тож Enter і
   * пробіл на кнопках «Попередній/Наступний місяць» (і в слотах header/footer)
   * гасилися preventDefault і обирали сфокусований день замість гортання.
   */
  if (!(event.target as Element | null)?.closest?.('[role="gridcell"]')) return

  const current = focusedDate.value
  const step: Record<string, () => Date> = {
    ArrowLeft: () => addDays(current, -1),
    ArrowRight: () => addDays(current, 1),
    ArrowUp: () => addDays(current, -7),
    ArrowDown: () => addDays(current, 7),
    Home: () => addDays(current, -((current.getDay() - props.weekStartsOn + 7) % 7)),
    End: () => addDays(current, 6 - ((current.getDay() - props.weekStartsOn + 7) % 7)),
  }

  if (event.key in step) {
    event.preventDefault()
    void moveFocus(step[event.key]!())
    return
  }

  if (event.key === 'PageUp' || event.key === 'PageDown') {
    event.preventDefault()
    const direction = event.key === 'PageUp' ? -1 : 1
    void moveFocus(addMonths(current, event.shiftKey ? direction * 12 : direction))
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    select(current)
  }
}

defineExpose({
  /**
   * Ставить фокус на активну клітинку сітки. `options` — як у нативного
   * focus(): панель-обгортка передає `preventScroll`, поки ще не спозиціонована.
   */
  focus: (options?: FocusOptions) =>
    gridEl.value?.querySelector<HTMLElement>('[data-focused="true"]')?.focus(options),
  /** Перемотує показ до місяця вказаної дати. */
  goToMonth: (date: Date) => setMonth(date),
})
</script>

<template>
  <div ref="gridEl" class="inline-block" @keydown="onKeydown">
    <div class="flex flex-col gap-4 sm:flex-row">
      <div v-for="(grid, gridIndex) in grids" :key="gridIndex" class="min-w-0">
        <slot
          name="header"
          :month="grid.month"
          :label="monthFormatter.format(grid.month)"
          :previous="() => setMonth(addMonths(viewMonth, -1))"
          :next="() => setMonth(addMonths(viewMonth, 1))"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <button
              v-if="gridIndex === 0"
              type="button"
              class="relative flex h-10 w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8 pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-12"
              aria-label="Попередній місяць"
              :disabled="disabled"
              @click="setMonth(addMonths(viewMonth, -1))"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <span v-else class="h-10 w-10 md:h-8 md:w-8" aria-hidden="true" />

            <!-- aria-live: інакше PageUp/PageDown міняє місяць беззвучно. -->
            <span
              :id="`${baseId}-caption-${gridIndex}`"
              class="flex-1 text-center text-sm font-semibold capitalize text-ink"
              aria-live="polite"
            >{{ monthFormatter.format(grid.month) }}</span>

            <button
              v-if="gridIndex === grids.length - 1"
              type="button"
              class="relative flex h-10 w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8 pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-12"
              aria-label="Наступний місяць"
              :disabled="disabled"
              @click="setMonth(addMonths(viewMonth, 1))"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <span v-else class="h-10 w-10 md:h-8 md:w-8" aria-hidden="true" />
          </div>
        </slot>

        <table
          role="grid"
          :aria-labelledby="`${baseId}-caption-${gridIndex}`"
          class="border-collapse"
        >
          <thead>
            <tr>
              <th v-if="showWeekNumbers" scope="col" class="w-8 pb-1">
                <span class="sr-only">Номер тижня</span>
              </th>
              <th
                v-for="weekday in weekdays"
                :key="weekday.long"
                scope="col"
                :aria-label="weekday.long"
                class="w-10 pb-1 text-xs font-medium capitalize text-muted"
              >
                <span aria-hidden="true">{{ weekday.short }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="week in 6" :key="week">
              <th
                v-if="showWeekNumbers"
                scope="row"
                class="pr-1 text-right text-[11px] font-normal tabular-nums text-muted"
              >
                {{ isoWeekNumber(grid.days[(week - 1) * 7]!) }}
              </th>
              <td
                v-for="day in grid.days.slice((week - 1) * 7, week * 7)"
                :key="day.toISOString()"
                role="gridcell"
                :aria-selected="dayState(day, grid.month).selected"
                class="p-0"
              >
                <!-- Прихований день лишається КОМІРКОЮ: role="grid" вимагає
                     однакової кількості клітинок у кожному рядку. -->
                <span
                  v-if="!showOutsideDays && dayState(day, grid.month).outside"
                  class="block h-10 w-10"
                  aria-hidden="true"
                />
                <slot v-else name="day" v-bind="dayState(day, grid.month)">
                  <button
                    type="button"
                    :data-focused="dayState(day, grid.month).focused"
                    :tabindex="dayState(day, grid.month).focused ? 0 : -1"
                    :aria-disabled="dayState(day, grid.month).disabled || undefined"
                    :aria-current="dayState(day, grid.month).today ? 'date' : undefined"
                    :aria-label="ariaLabelFor(day, dayState(day, grid.month))"
                    :class="dayClass(dayState(day, grid.month))"
                    @click="select(day)"
                    @mouseenter="hovered = day"
                    @mouseleave="hovered = null"
                    @focus="focusedDate = day"
                  >
                    <span aria-hidden="true">{{ day.getDate() }}</span>
                  </button>
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="$slots.footer" class="mt-3 border-t border-line pt-3">
      <slot name="footer" />
    </div>
  </div>
</template>
