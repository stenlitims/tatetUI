<script setup lang="ts">
import { computed, nextTick, onBeforeUpdate, shallowRef, useId } from 'vue'
import { errorTextClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

const props = withDefaults(
  defineProps<{
    /** Оцінка. `null` — ще не оцінено. Використовуйте через `v-model`. */
    modelValue?: number | null
    /** Кількість зірок. */
    max?: number
    /**
     * Лише показ: без полів вводу, дробове значення заповнює зірку
     * частково (4,3 — третина п'ятої). Для карток товару й відгуків.
     */
    readonly?: boolean
    disabled?: boolean
    /** Розмір зірки. На дотику ціль кожної зірки — 44px незалежно від розміру. */
    size?: 'sm' | 'md' | 'lg'
    /**
     * Дозволити зняти оцінку: повторний клік по обраній зірці, ← на першій
     * або Delete. Вимикайте, коли оцінка обов'язкова.
     */
    clearable?: boolean
    /**
     * Смисл кожного значення: `['Жахливо', 'Погано', 'Нормально', 'Добре',
     * 'Чудово']`. Показується поруч із зірками й додається до назви кожної
     * радіокнопки — «4 з 5: Добре».
     */
    labels?: string[]
    /** Числове значення поруч із зірками: «4,6». */
    showValue?: boolean
    /** Кількість відгуків поруч: «(128)». Потрапляє в доступну назву. */
    count?: number
    label?: string
    /** Доступна назва, коли видимого `label` немає. */
    ariaLabel?: string
    required?: boolean
    /** Текст помилки. Стан помилки вмикає САМА наявність тексту. */
    error?: string
    /** Підказка під зірками. Ховається, коли показано помилку. */
    hint?: string
    id?: string
    name?: string
  }>(),
  {
    modelValue: null,
    max: 5,
    readonly: false,
    disabled: false,
    size: 'md',
    clearable: true,
    labels: undefined,
    showValue: false,
    count: undefined,
    label: undefined,
    ariaLabel: undefined,
    required: false,
    error: undefined,
    hint: undefined,
    id: undefined,
    name: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  change: [value: number | null]
}>()

defineSlots<{
  /**
   * Власний гліф замість зірки (серце, крапка). Рендериться двічі — порожнім
   * і заповненим шаром, тож малюйте `currentColor`.
   */
  icon?: (props: { filled: boolean }) => unknown
}>()

type Size = NonNullable<typeof props.size>

/** П'ятикутна зірка, відцентрована у 24×24 (верх 3.4, низ 20.5). */
const STAR_PATH = 'M12 3.4l2.78 5.64 6.22.9-4.5 4.39 1.06 6.2L12 17.6l-5.56 2.93 1.06-6.2L3 9.94l6.22-.9z'

const STAR_SIZES: Record<Size, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
}

const TEXT_SIZES: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

const generatedId = useId()
const groupId = computed(() => props.id ?? `${generatedId}-rating`)
const labelId = `${generatedId}-label`
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`
// Радіо без спільного name — це не група: браузер не знає, що вони разом,
// і форма серіалізує кожне окремо.
const inputName = computed(() => props.name ?? `${generatedId}-rating`)

const stars = computed(() => {
  const max = Number.isFinite(props.max) && props.max > 0 ? Math.floor(props.max) : 5
  return Array.from({ length: max }, (_, index) => index + 1)
})
const maxStars = computed(() => stars.value.length)

const value = computed(() => {
  const raw = props.modelValue
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null
  return Math.min(raw, maxStars.value)
})

const numberFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 })
const pluralRules = new Intl.PluralRules('uk-UA')
const REVIEW_FORMS: Record<string, string> = {
  one: 'відгук',
  few: 'відгуки',
  many: 'відгуків',
  other: 'відгуку',
}

/* ------------------------------------------------------------------ */
/*  Показ                                                              */
/* ------------------------------------------------------------------ */

const hoverValue = shallowRef<number | null>(null)
const shown = computed(() => (props.readonly ? value.value : hoverValue.value ?? value.value) ?? 0)

/** Частка заповнення зірки: 1, 0 або дріб на межі (лише в readonly). */
function fill(star: number): number {
  const raw = shown.value - (star - 1)
  if (!props.readonly) return raw >= 1 ? 1 : 0
  return Math.min(Math.max(raw, 0), 1)
}

const caption = computed(() => {
  if (!props.labels?.length) return ''
  const current = Math.round(hoverValue.value ?? value.value ?? 0)
  return current > 0 ? (props.labels[current - 1] ?? '') : ''
})

const readonlyName = computed(() => {
  const base = value.value == null
    ? 'Ще немає оцінок'
    : `Оцінка ${numberFormat.format(value.value)} з ${maxStars.value}`
  if (props.count == null) return base
  return `${base}, ${props.count} ${REVIEW_FORMS[pluralRules.select(props.count)]}`
})

/* ------------------------------------------------------------------ */
/*  Ввід                                                               */
/* ------------------------------------------------------------------ */

const inputs = shallowRef<(HTMLInputElement | null)[]>([])
onBeforeUpdate(() => {
  inputs.value = []
})

const focused = shallowRef<number | null>(null)
const interactive = computed(() => !props.readonly && !props.disabled)

// Одна зупинка Tab на групу: обрана зірка, а без оцінки — перша.
const tabStop = computed(() => Math.max(1, Math.round(value.value ?? 1)))

function radioName(star: number): string {
  const meaning = props.labels?.[star - 1]
  return meaning ? `${star} з ${maxStars.value}: ${meaning}` : `${star} з ${maxStars.value}`
}

function commit(next: number | null) {
  if (!interactive.value || next === value.value) return
  emit('update:modelValue', next)
  emit('change', next)
}

/*
 * Повторний клік по обраній зірці знімає оцінку. Ловимо його на мітці й
 * лише для кліку вказівником (target — не сам input): клік клавіатурою
 * (Space) і синтетичний клік, яким мітка активує свій input, приходять
 * саме з target = input, і їх рахувати не можна — інакше Space на
 * обраній зірці скидав би оцінку.
 */
function onLabelClick(event: MouseEvent, star: number) {
  if (!interactive.value || (event.target as HTMLElement).tagName === 'INPUT') return
  if (props.clearable && star === value.value) {
    event.preventDefault()
    commit(null)
  }
}

/*
 * Стрілки — власні, а не нативні для радіо. Нативна група зациклюється
 * (→ на п'ятій зірці стрибає на першу, тобто ставить «1» замість «5») і не
 * вміє зняти оцінку. Тут ← на першій зірці скидає оцінку, якщо дозволено,
 * а → на останній просто стоїть.
 */
function onKeydown(event: KeyboardEvent, star: number) {
  if (!interactive.value) return
  const current = value.value ?? 0
  let next: number | null | undefined
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(maxStars.value, Math.round(current) + 1)
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    const lowered = Math.round(current) - 1
    next = lowered >= 1 ? lowered : props.clearable ? null : 1
  } else if (event.key === 'Home') next = 1
  else if (event.key === 'End') next = maxStars.value
  else if ((event.key === 'Delete' || event.key === 'Backspace') && props.clearable) next = null
  else return

  event.preventDefault()
  commit(next)
  const target = next ?? star
  void nextTick(() => inputs.value[target - 1]?.focus())
}

function onFocus(event: FocusEvent, star: number) {
  // Кільце фокуса — лише для клавіатури, як :focus-visible у решти полів.
  focused.value = (event.target as HTMLElement).matches(':focus-visible') ? star : null
}

function onPointerEnter(event: PointerEvent, star: number) {
  // Дотик не має наведення: без цієї перевірки палець лишав би «тінь»
  // попереднього перегляду після того, як оцінку вже поставлено.
  if (!interactive.value || event.pointerType === 'touch') return
  hoverValue.value = star
}

const describedBy = computed(() => (props.error ? errorId : props.hint ? hintId : undefined))
</script>

<template>
  <!-- Показ: одне зображення з назвою, а не п'ять безіменних іконок. -->
  <span
    v-if="readonly"
    role="img"
    class="inline-flex items-center gap-1.5 align-middle"
    :class="TEXT_SIZES[size]"
    :aria-label="readonlyName"
  >
    <span class="inline-flex items-center gap-0.5" aria-hidden="true">
      <span v-for="star in stars" :key="star" class="relative inline-flex shrink-0" :class="STAR_SIZES[size]">
        <span class="block h-full w-full text-line-strong">
          <slot name="icon" :filled="false">
            <svg class="h-full w-full" viewBox="0 0 24 24" fill="currentColor">
              <path :d="STAR_PATH" />
            </svg>
          </slot>
        </span>
        <!-- Заповнений шар обрізається по ширині: 4,3 з 5 — третина п'ятої зірки. -->
        <span class="absolute inset-y-0 left-0 overflow-hidden text-rating" :style="{ width: `${fill(star) * 100}%` }">
          <span class="block" :class="STAR_SIZES[size]">
            <slot name="icon" :filled="true">
              <svg class="h-full w-full" viewBox="0 0 24 24" fill="currentColor">
                <path :d="STAR_PATH" />
              </svg>
            </slot>
          </span>
        </span>
      </span>
    </span>
    <span v-if="showValue && value != null" class="font-semibold tabular-nums text-ink" aria-hidden="true">
      {{ numberFormat.format(value) }}
    </span>
    <span v-if="count != null" class="tabular-nums text-muted" aria-hidden="true">({{ count }})</span>
  </span>

  <fieldset v-else :id="groupId" :disabled="disabled" class="min-w-0" :aria-describedby="describedBy">
    <legend v-if="label" :id="labelId" :class="labelClass">
      {{ label }}<span v-if="required" class="text-danger" aria-hidden="true"> *</span>
    </legend>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div
        role="radiogroup"
        class="inline-flex items-center"
        :aria-labelledby="label ? labelId : undefined"
        :aria-label="label ? undefined : ariaLabel ?? 'Оцінка'"
        :aria-invalid="!!error || undefined"
        :aria-required="required || undefined"
        @pointerleave="hoverValue = null"
      >
        <label
          v-for="star in stars"
          :key="star"
          class="group relative flex items-center justify-center p-0.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          :class="interactive ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'"
          @click="onLabelClick($event, star)"
          @pointerenter="onPointerEnter($event, star)"
        >
          <input
            :ref="(el) => (inputs[star - 1] = el as HTMLInputElement)"
            type="radio"
            class="sr-only"
            :name="inputName"
            :value="star"
            :checked="value === star"
            :required="required"
            :disabled="disabled"
            :tabindex="star === tabStop ? 0 : -1"
            :aria-label="radioName(star)"
            @change="commit(star)"
            @keydown="onKeydown($event, star)"
            @focus="onFocus($event, star)"
            @blur="focused = null"
          />
          <!--
            Натискання дає відгук масштабом — як кнопки бібліотеки: на
            дотику :hover немає, і без цього між дотиком і зміною кольору
            немає жодного проміжного сигналу.
          -->
          <span
            class="relative rounded-control transition-[color,scale] duration-(--duration-fast) group-active:scale-90"
            :class="[
              STAR_SIZES[size],
              fill(star) ? 'text-rating' : 'text-line-strong',
              focused === star ? 'ring-2 ring-ring ring-offset-2 ring-offset-ring-offset' : '',
            ]"
          >
            <slot name="icon" :filled="!!fill(star)">
              <svg class="h-full w-full" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path :d="STAR_PATH" />
              </svg>
            </slot>
          </span>
        </label>
      </div>

      <span v-if="caption" class="text-muted" :class="TEXT_SIZES[size]" aria-hidden="true">{{ caption }}</span>
    </div>

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </fieldset>
</template>
