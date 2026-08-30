<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import {
  errorTextClass,
  fieldClass,
  helperTextClass,
  labelClass,
  type FieldSize,
} from '~/utils/uiFieldStyles'

const props = withDefaults(
  defineProps<{
    /** Значення. Порожнє поле — `null`, ніколи не `NaN`. Через `v-model`. */
    modelValue?: number | null
    /** Найменше допустиме значення. */
    min?: number
    /** Найбільше допустиме значення. */
    max?: number
    /** Крок стрілок і кнопок «−»/«+». */
    step?: number
    /** Крок PageUp/PageDown. Типово — `step` × 10. */
    stepFast?: number
    /** Скільки знаків після коми лишати. Округлення відбувається на blur. */
    precision?: number
    /** Суфікс одиниці: %, грн, шт. Потрапляє і в `aria-valuetext`. */
    unit?: string
    /**
     * Групувати тисячі, поки поле поза фокусом. У фокусі показується сире
     * число: редагувати рядок із нерозривними пробілами неможливо.
     */
    formatOnBlur?: boolean
    /** Кнопки «−» і «+». Без них лишається чистий числовий ввід. */
    steppers?: boolean
    /** Висота поля. На мобільному кожен розмір вищий за десктопний. */
    size?: FieldSize
    /** Текст помилки. Стан помилки вмикає САМА наявність тексту. */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    label?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    required?: boolean
    id?: string
    name?: string
  }>(),
  {
    modelValue: null,
    step: 1,
    precision: 0,
    formatOnBlur: true,
    steppers: true,
    size: 'md',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  change: [value: number | null]
}>()

// Слотів немає навмисно: обидва внутрішні краї поля зайняті кнопками
// «−»/«+», і слот leading/trailing зіткнувся б із ними. Одиниця — props.
defineSlots<Record<string, never>>()

const generatedId = useId()
const inputId = computed(() => props.id || `${generatedId}-number`)
const hintId = computed(() => (props.hint && !props.error ? `${inputId.value}-hint` : undefined))
const errorId = computed(() => (props.error ? `${inputId.value}-error` : undefined))
// Рівно один опис: інакше скрінрідер зачитає підказку раніше за причину відмови.
const describedBy = computed(() => errorId.value ?? hintId.value)

const hasError = computed(() => !!props.error)
const inputEl = ref<HTMLInputElement | null>(null)
const focused = ref(false)

/*
 * Видимий рядок — НЕ модель.
 *
 * У фокусі поле показує сире число, поза фокусом — згруповане. Якби
 * значення читалося просто з props, батьківський відгук переписував би
 * «1,» на «1» просто під час набору, а каретка стрибала б у кінець.
 * Тому рядок живе окремо і синхронізується з моделлю ЛИШЕ поза фокусом.
 */
const display = ref('')

const decimalFormatter = computed(
  () =>
    new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: props.precision,
      maximumFractionDigits: props.precision,
    }),
)

function format(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  if (!props.formatOnBlur) return String(round(value))
  return decimalFormatter.value.format(value)
}

function round(value: number): number {
  const factor = 10 ** Math.max(0, props.precision)
  return Math.round(value * factor) / factor
}

/*
 * Розбір українського запису: кома як десятковий роздільник і нерозривний
 * пробіл як роздільник тисяч. Number.parseFloat не розуміє ні першого, ні
 * другого — на «1 234,5» він поверне 1.
 */
function parse(raw: string): number | null {
  const normalized = raw
    .replace(/[\s  ]/g, '')
    .replace(',', '.')
    .trim()
  if (normalized === '' || normalized === '-' || normalized === '.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number): number {
  let next = value
  if (typeof props.min === 'number') next = Math.max(props.min, next)
  if (typeof props.max === 'number') next = Math.min(props.max, next)
  return round(next)
}

watch(
  () => props.modelValue,
  (value) => {
    if (!focused.value) display.value = format(value)
  },
  { immediate: true },
)

function commit(value: number | null, notify = true) {
  const next = value === null ? null : clamp(value)
  if (next !== props.modelValue) {
    emit('update:modelValue', next)
    if (notify) emit('change', next)
  }
  return next
}

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  display.value = raw
  // Проміжні стани «1,», «-», «0,00» парсяться, але перезаписувати рядок
  // на них не можна — інакше набрати дробове число неможливо.
  commit(parse(raw), false)
}

function onFocus() {
  focused.value = true
  // Сире значення для редагування: групування заважає ставити каретку.
  display.value = props.modelValue === null ? '' : String(round(props.modelValue))
}

function onBlur() {
  focused.value = false
  const parsed = parse(display.value)
  const next = commit(parsed)
  display.value = format(next)
}

const fastStep = computed(() => props.stepFast ?? props.step * 10)

function reflectCommittedValue(value: number | null) {
  const text = focused.value ? (value === null ? '' : String(value)) : format(value)
  display.value = text
  // Keyboard events відбуваються до наступного render tick. Віддзеркалюємо
  // кероване значення негайно, щоб DOM і accessibility tree не відставали.
  if (!inputEl.value) return
  inputEl.value.value = text
  if (value === null) inputEl.value.removeAttribute('aria-valuenow')
  else inputEl.value.setAttribute('aria-valuenow', String(value))
  if (props.unit && value !== null) inputEl.value.setAttribute('aria-valuetext', `${format(value)} ${props.unit}`)
  else inputEl.value.removeAttribute('aria-valuetext')
}

function nudge(amount: number) {
  if (props.disabled || props.readonly) return
  // Під час серії клавіш props може ще чекати наступного render tick.
  // Видимий рядок уже містить останній крок, тому він є надійнішою базою.
  const visibleValue = focused.value ? parse(display.value) : null
  const base = visibleValue ?? props.modelValue ?? props.min ?? 0
  const next = commit(base + amount)
  reflectCommittedValue(next)
}

function jumpTo(value: number) {
  if (props.disabled || props.readonly) return
  const next = commit(value)
  reflectCommittedValue(next)
}

function onKeydown(event: KeyboardEvent) {
  const map: Record<string, number> = {
    ArrowUp: props.step,
    ArrowDown: -props.step,
    PageUp: fastStep.value,
    PageDown: -fastStep.value,
  }
  if (event.key in map) {
    event.preventDefault()
    nudge(map[event.key]!)
    return
  }
  if (event.key === 'Home' && typeof props.min === 'number') {
    event.preventDefault()
    jumpTo(props.min)
  } else if (event.key === 'End' && typeof props.max === 'number') {
    event.preventDefault()
    jumpTo(props.max)
  }
}

/*
 * Утримання кнопки повторює крок. Таймери знімаються на pointerup,
 * pointercancel, pointerleave і на приховуванні вкладки: пропустити хоч
 * один шлях — і значення продовжує рости у фоновій вкладці.
 */
let holdTimer: ReturnType<typeof setTimeout> | null = null
let repeatTimer: ReturnType<typeof setInterval> | null = null

function stopHold() {
  if (holdTimer) clearTimeout(holdTimer)
  if (repeatTimer) clearInterval(repeatTimer)
  holdTimer = null
  repeatTimer = null
}

function startHold(amount: number) {
  stopHold()
  nudge(amount)
  holdTimer = setTimeout(() => {
    repeatTimer = setInterval(() => nudge(amount), 60)
  }, 500)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', stopHold)
}
onBeforeUnmount(() => {
  stopHold()
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', stopHold)
})

const atMin = computed(() => typeof props.min === 'number' && (props.modelValue ?? props.min) <= props.min)
const atMax = computed(() => typeof props.max === 'number' && (props.modelValue ?? props.max) >= props.max)

const valueText = computed(() => {
  if (props.modelValue === null) return undefined
  return props.unit ? `${format(props.modelValue)} ${props.unit}` : undefined
})

const inputClasses = computed(() =>
  fieldClass(props.size, {
    error: hasError.value,
    disabled: props.disabled,
    padLeft: props.steppers ? 'pl-12 md:pl-9' : undefined,
    padRight: props.steppers ? 'pr-12 md:pr-9' : props.unit ? 'pr-10' : undefined,
    extra: 'text-center tabular-nums',
  }),
)

/*
 * Кнопка лишається в межах поля (h-12 на мобільному = 45px — ціль і так
 * 44+), на десктопі h-9 усередині поля md:h-9, зону дотику на дотику
 * добудовує невидимий ::after, як у UiSwitch.
 */
const STEPPER_CLASS =
  'ui-number-stepper absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9'

defineExpose({
  /** Ставить фокус на поле. */
  focus: () => inputEl.value?.focus(),
  /** Виділяє весь текст у полі. */
  select: () => inputEl.value?.select(),
})
</script>

<template>
  <div>
    <label v-if="label" :for="inputId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <button
        v-if="steppers"
        type="button"
        :class="[STEPPER_CLASS, 'left-0.5']"
        :disabled="disabled || readonly || atMin"
        aria-label="Зменшити"
        tabindex="-1"
        @pointerdown.prevent="startHold(-step)"
        @pointerup="stopHold"
        @pointercancel="stopHold"
        @pointerleave="stopHold"
      >
        <span aria-hidden="true" class="text-lg leading-none">−</span>
      </button>

      <!--
        type="text", а не number. Нативний number відкидає згрупований
        рядок, малює власні стрілки поруч із нашими й повертає порожній
        рядок і для «пусто», і для «невалідно» — розрізнити їх неможливо.
        role="spinbutton" повертає семантику, яку ми при цьому втрачаємо.
      -->
      <input
        :id="inputId"
        ref="inputEl"
        type="text"
        inputmode="decimal"
        role="spinbutton"
        :value="display"
        :name="name"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :aria-valuenow="modelValue ?? undefined"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuetext="valueText"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        :class="inputClasses"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      >

      <span
        v-if="unit && !steppers"
        aria-hidden="true"
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted"
      >{{ unit }}</span>

      <button
        v-if="steppers"
        type="button"
        :class="[STEPPER_CLASS, 'right-0.5']"
        :disabled="disabled || readonly || atMax"
        aria-label="Збільшити"
        tabindex="-1"
        @pointerdown.prevent="startHold(step)"
        @pointerup="stopHold"
        @pointercancel="stopHold"
        @pointerleave="stopHold"
      >
        <span aria-hidden="true" class="text-lg leading-none">+</span>
      </button>
    </div>

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>

<style scoped>
/*
 * Невидима зона натискання 44×44 навколо кнопок «−» і «+».
 *
 * Той самий прийом, що в UiSwitch: сама кнопка мусить лишатися в межах
 * висоти поля (41.25px при корені 15px), а палець має влучати в 44.
 */
@media (hover: none) and (pointer: coarse) {
  .ui-number-stepper::after {
    content: '';
    position: absolute;
    inset: 50% auto auto 50%;
    width: max(100%, 44px);
    height: max(100%, 44px);
    transform: translate(-50%, -50%);
  }
}
</style>
