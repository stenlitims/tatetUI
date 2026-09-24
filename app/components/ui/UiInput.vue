<script setup lang="ts">
import { computed, ref, useAttrs, useId, useSlots } from 'vue'
import {
  clearButtonClass,
  errorTextClass,
  fieldClass,
  fieldTextSizes,
  helperTextClass,
  labelClass,
  splitFieldAttrs,
  type FieldSize,
} from '~/utils/uiFieldStyles'

// class/style лишаються на обгортці, решта атрибутів іде на <input>:
// інакше aria-label, maxlength чи inputmode мовчки осідали б на <div>.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Значення поля. Використовуйте через `v-model`. */
    modelValue?: string | number | null
    /** Видимий лейбл. Пов'язується з полем через `for`/`id` автоматично. */
    label?: string
    placeholder?: string
    /**
     * Тип нативного поля. Впливає і на екранну клавіатуру телефона, і на
     * автозаповнення браузера.
     */
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'
    /** Висота поля. На мобільному кожен розмір вищий за десктопний. */
    size?: FieldSize
    disabled?: boolean
    readonly?: boolean
    required?: boolean
    /**
     * Текст помилки. Сама його наявність вмикає стан помилки — окремого
     * булевого прапорця немає навмисно, щоб не було стану «червоне поле
     * без пояснення чому».
     */
    error?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    /**
     * Значення нативного `autocomplete`. Без нього браузер не підставить
     * збережені дані.
     */
    autocomplete?: string
    /**
     * Кнопка очищення праворуч, коли поле не порожнє. Не потрапляє в Tab —
     * з клавіатури поле чистять Ctrl+A і Backspace, а зайва зупинка в
     * кожному полі форми лише подовжує обхід.
     */
    clearable?: boolean
    /**
     * Для `type="password"`: кнопка «показати пароль». На відміну від
     * кнопки очищення, ДОСТУПНА з клавіатури — це самостійна дія, без якої
     * користувач не може перевірити, що набрав.
     */
    passwordToggle?: boolean
    /**
     * Текст, приклеєний до поля зліва: `https://`, `+380`. Живе ПОЗА полем,
     * а не в слоті `leading`: слот резервує місце під іконку, і довший
     * текст наїжджав би на введене значення. Входить у доступну назву.
     */
    prefix?: string
    /** Текст, приклеєний до поля справа: `грн`, `.com.ua`, `кг`. Входить у доступну назву. */
    suffix?: string
    /** Максимальна кількість символів. Передається як нативний `maxlength`. */
    maxLength?: number
    /** Показувати лічильник символів. Працює разом із `maxLength`. */
    showCount?: boolean
    /** Стабільний DOM id. `name` використовується лише для форми. */
    id?: string
    name?: string
  }>(),
  { type: 'text', size: 'md', showCount: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  clear: []
}>()

defineSlots<{
  /** Іконка або кнопка ліворуч усередині поля. */
  leading?: () => unknown
  /** Іконка або кнопка праворуч усередині поля. */
  trailing?: () => unknown
}>()

const attrs = useAttrs()
const fieldAttrs = computed(() => splitFieldAttrs(attrs))

const generatedId = useId()
const inputId = computed(() => props.id ?? `${generatedId}-input`)
const labelId = `${generatedId}-label`
const prefixId = `${generatedId}-prefix`
const suffixId = `${generatedId}-suffix`
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`
const counterId = `${generatedId}-counter`

const inputEl = ref<HTMLInputElement | null>(null)

const hasError = computed(() => !!props.error)

const normalizedMaxLength = computed(() => {
  const value = props.maxLength
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined
})
const showCounter = computed(() => props.showCount && normalizedMaxLength.value !== undefined)
const characterCount = computed(() => String(props.modelValue ?? '').length)

/*
 * aria-describedby вказує рівно на один активний опис. Якщо передати обидва
 * id, скрінрідер зачитає і підказку, і помилку підряд — користувач почує
 * інструкцію, яку щойно порушив, раніше за причину відмови. Лічильник —
 * останній у черзі, як в UiTextarea.
 */
const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  if (showCounter.value) return counterId
  return undefined
})

/*
 * Префікс і суфікс — частина назви, а не опис: «Ціна, грн» пояснює, що
 * вводити, а aria-describedby вже зайнятий помилкою/підказкою. Без видимого
 * лейбла назву дає aria-label споживача, і перебивати її не можна.
 */
const labelledBy = computed(() => {
  if (!props.label || (!props.prefix && !props.suffix)) return undefined
  return [labelId, props.prefix ? prefixId : '', props.suffix ? suffixId : ''].filter(Boolean).join(' ')
})

// useSlots() для рантайм-перевірки; defineSlots вище — лише для типів і
// таблиці API. Двічі defineSlots викликати не можна.
const slots = useSlots()

const revealed = ref(false)
const isPassword = computed(() => props.type === 'password')
// Показаний пароль — це звичайне текстове поле; `type` перемикається, а
// не дублюється другим інпутом, щоб значення й фокус лишилися на місці.
const nativeType = computed(() => (isPassword.value && revealed.value ? 'text' : props.type))

const hasValue = computed(() => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '')
const showClear = computed(
  () => props.clearable && hasValue.value && !props.disabled && !props.readonly,
)
const showPasswordToggle = computed(() => props.passwordToggle && isPassword.value && !props.disabled)

// Скільки елементів стоїть праворуч — від цього залежить відступ тексту.
const trailingCount = computed(
  () => Number(!!slots.trailing) + Number(showClear.value) + Number(showPasswordToggle.value),
)

/*
 * Відступ під іконку інакше накладеться на текст введення. Класи — літерали,
 * а не `pr-${n}`: Tailwind сканує вихідний код і склеєного в рантаймі класу
 * в бандлі не буде.
 */
const TRAILING_PAD = ['', 'pr-9', 'pr-16', 'pr-24'] as const

const inputClasses = computed(() =>
  fieldClass(props.size, {
    error: hasError.value,
    disabled: props.disabled,
    padLeft: slots.leading ? 'pl-9' : undefined,
    padRight: TRAILING_PAD[Math.min(trailingCount.value, 3)] || undefined,
    // Кут, яким поле торкається префікса/суфікса, стає прямим — інакше між
    // ними світився б зазор заокруглення.
    extra: [props.prefix ? 'rounded-l-none' : '', props.suffix ? 'rounded-r-none' : ''].join(' '),
  }),
)

const ADDON_PAD: Record<FieldSize, string> = {
  sm: 'px-2.5 md:px-2',
  md: 'px-3 md:px-2.5',
  lg: 'px-3.5 md:px-3',
}

function addonClass(side: 'left' | 'right') {
  return [
    'flex shrink-0 select-none items-center whitespace-nowrap border bg-subtle text-muted',
    fieldTextSizes[props.size],
    ADDON_PAD[props.size],
    side === 'left' ? 'rounded-l-control border-r-0' : 'rounded-r-control border-l-0',
    hasError.value ? 'border-danger' : 'border-line',
    props.disabled ? 'opacity-50' : '',
  ]
}

// Контейнер праворуч не ловить кліки, тож кнопкам повертаємо pointer-events;
// relative — точка відліку для невидимої зони дотику з clearButtonClass.
const trailingButtonClass = `pointer-events-auto relative ${clearButtonClass}`

function clear() {
  emit('update:modelValue', props.type === 'number' ? null : '')
  emit('clear')
  // Фокус назад у поле: користувач очистив, щоб набрати заново.
  inputEl.value?.focus()
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  // Порожній числовий інпут дає '' — віддаємо null, щоб не отримати NaN
  // на першому ж арифметичному використанні.
  if (props.type === 'number') {
    emit('update:modelValue', target.value === '' ? null : Number(target.value))
    return
  }
  emit('update:modelValue', target.value)
}

defineExpose({
  /** Ставить фокус на поле. */
  focus: () => inputEl.value?.focus(),
  /** Виділяє весь текст. */
  select: () => inputEl.value?.select(),
})
</script>

<template>
  <div v-bind="fieldAttrs.root">
    <label v-if="label" :id="labelId" :for="inputId" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <div class="flex">
      <span v-if="prefix" :id="prefixId" :class="addonClass('left')">{{ prefix }}</span>

      <!-- focus-within:z-10 — кільце фокуса лягає поверх суфікса, а не під
           нього: суфікс стоїть у DOM пізніше й інакше перекрив би край. -->
      <div class="relative min-w-0 flex-1 focus-within:z-10">
        <span
          v-if="$slots.leading"
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted"
        >
          <slot name="leading" />
        </span>

        <!-- v-bind ОСТАННІМ: як і звичайний fallthrough у Vue, атрибут
             споживача перемагає, а не затирається нашим undefined. -->
        <input
          :id="inputId"
          ref="inputEl"
          :value="modelValue ?? ''"
          :type="nativeType"
          :name="name"
          :placeholder="placeholder"
          :disabled="disabled"
          :readonly="readonly"
          :required="required"
          :autocomplete="autocomplete"
          :maxlength="normalizedMaxLength"
          :class="inputClasses"
          :aria-invalid="hasError || undefined"
          :aria-describedby="describedBy"
          :aria-labelledby="labelledBy"
          v-bind="fieldAttrs.control"
          @input="onInput"
          @focus="emit('focus', $event)"
          @blur="emit('blur', $event)"
        />

        <!-- Контейнер не ловить кліки, а кнопки всередині — ловлять: інакше
             порожня смуга праворуч перекривала б текст поля. -->
        <span
          v-if="trailingCount > 0"
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 pr-1.5 text-muted"
        >
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="scale-75 opacity-0"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="scale-75 opacity-0"
          >
            <button
              v-if="showClear"
              type="button"
              tabindex="-1"
              :class="trailingButtonClass"
              aria-label="Очистити поле"
              @click="clear"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </Transition>

          <button
            v-if="showPasswordToggle"
            type="button"
            :class="trailingButtonClass"
            :aria-label="revealed ? 'Сховати пароль' : 'Показати пароль'"
            :aria-pressed="revealed"
            @click="revealed = !revealed"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <template v-if="revealed">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9 4 10 7-.4 1.2-1.2 2.5-2.3 3.6" />
                <path d="M6.6 6.6C4.4 8 2.8 10 2 12c1 3 5 7 10 7 1.5 0 2.9-.3 4.1-.9" />
              </template>
              <template v-else>
                <path d="M2 12c1-3 5-7 10-7s9 4 10 7c-1 3-5 7-10 7S3 15 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </template>
            </svg>
          </button>

          <span v-if="$slots.trailing" class="flex items-center pr-1.5">
            <slot name="trailing" />
          </span>
        </span>
      </div>

      <span v-if="suffix" :id="suffixId" :class="addonClass('right')">{{ suffix }}</span>
    </div>

    <!-- role="alert" лише на помилці: підказка не має перебивати те, що
         користувач читає зараз. -->
    <div v-if="error || hint || showCounter" class="flex items-start justify-between gap-3">
      <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
      <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
      <span v-else />
      <p
        v-if="showCounter"
        :id="counterId"
        class="mt-1 shrink-0 text-xs tabular-nums"
        :class="characterCount >= (normalizedMaxLength ?? Infinity) ? 'text-danger' : 'text-muted'"
      >
        {{ characterCount }} / {{ normalizedMaxLength }}
      </p>
    </div>
  </div>
</template>
