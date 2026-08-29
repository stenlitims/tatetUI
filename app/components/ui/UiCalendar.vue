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
watch(() => props.month, (value) => { if (value) viewMonth.value = startOfMonth(value) })

function setMonth(next: Date) {
  viewMonth.value = startOfMonth(next)
  emit('update:month', viewMonth.value)
}

function initialFocus(): Date {
  if (selectedSingle.value) return startOfDay(selectedSingle.value)
  if (selectedRange.value) return startOfDay(selectedRange.value[0])
  const first = startOfMonth(viewMonth.value)
  if (todayDate.value.getMonth() === first.getMonth() && todayDate.value.getFullYear() === first.getFullYear()) {
    return todayDate.value
  }
  return clampDate(first, props.min, props.max)
}

const focusedDate = ref(initialFocus())

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

  return {
    date,
    selected,
    inRange,
    rangeStart,
    rangeEnd,
    today: isSameDay(date, todayDate.value),
    disabled: isDisabled(date),
    outside: isOutside(date, month),
    focused: isSameDay(date, focusedDate.value),
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

  if (state.outside) return `${base} cursor-pointer text-muted opacity-60 hover:bg-hover`
  if (state.today) return `${base} cursor-pointer font-semibold text-accent hover:bg-hover`
  return `${base} cursor-pointer text-ink hover:bg-hover`
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
    return
  }

  // Escape скасовує НЕЗАВЕРШЕНИЙ діапазон; якщо скасовувати нічого —
  // подія йде далі, щоб закрилася панель, у якій календар лежить.
  if (event.key === 'Escape' && pendingStart.value) {
    event.stopPropagation()
    pendingStart.value = null
  }
}

defineExpose({
  /** Ставить фокус на активну клітинку сітки. */
  focus: () => gridEl.value?.querySelector<HTMLElement>('[data-focused="true"]')?.focus(),
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
              class="flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:w-8"
              aria-label="Попередній місяць"
              :disabled="disabled"
              @click="setMonth(addMonths(viewMonth, -1))"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <span v-else class="h-11 w-11 md:h-8 md:w-8" aria-hidden="true" />

            <!-- aria-live: інакше PageUp/PageDown міняє місяць беззвучно. -->
            <span
              :id="`${baseId}-caption-${gridIndex}`"
              class="flex-1 text-center text-sm font-semibold capitalize text-ink"
              aria-live="polite"
            >{{ monthFormatter.format(grid.month) }}</span>

            <button
              v-if="gridIndex === grids.length - 1"
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:w-8"
              aria-label="Наступний місяць"
              :disabled="disabled"
              @click="setMonth(addMonths(viewMonth, 1))"
            >
              <span aria-hidden="true">›</span>
            </button>
            <span v-else class="h-11 w-11 md:h-8 md:w-8" aria-hidden="true" />
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
