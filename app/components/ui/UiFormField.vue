<script setup lang="ts">
import { computed, useId } from 'vue'
import { errorTextClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

const props = withDefaults(
  defineProps<{
    label?: string
    /**
     * Пояснення під лейблом, над полем — коли без нього поле незрозуміле
     * («Бачать лише адміністратори»). На відміну від `hint`, не ховається
     * при помилці.
     */
    description?: string
    /** Підказка під полем. Ховається, коли показано помилку. */
    hint?: string
    /**
     * Текст помилки. Стан помилки вмикає САМА наявність тексту — як в
     * усіх полях бібліотеки.
     */
    error?: string
    required?: boolean
    /**
     * id контрола. Лейбл вказує на нього через `for`, тож задавайте його
     * самому полю через слот: `<input :id="id">`.
     */
    id?: string
    /**
     * `fieldset` — для групи контролів (кілька чекбоксів, сегментний
     * перемикач): лейбл стає `<legend>`, і скрінрідер оголошує назву групи
     * при вході в будь-який її елемент. `div` — для одного поля.
     */
    as?: 'div' | 'fieldset'
    disabled?: boolean
  }>(),
  {
    label: undefined,
    description: undefined,
    hint: undefined,
    error: undefined,
    required: false,
    id: undefined,
    as: 'div',
    disabled: false,
  },
)

export interface FormFieldSlotProps {
  /** id для самого контрола — на нього вказує `for` лейбла. */
  id: string
  /** id лейбла — для `aria-labelledby` там, де `for` не працює. */
  labelId: string
  /** Рівно один опис: помилка, інакше підказка, плюс `description`. */
  describedBy: string | undefined
  /** Чи є помилка — для `aria-invalid`. */
  invalid: boolean
  required: boolean
  disabled: boolean
}

defineSlots<{
  /**
   * Сам контрол. Слот отримує все, що треба прив'язати: `id`, `labelId`,
   * `describedBy`, `invalid` — розкладайте їх на поле, і зв'язки лейбла,
   * підказки й помилки працюватимуть так само, як у вбудованих полях.
   */
  default?: (props: FormFieldSlotProps) => unknown
  /** Праворуч від лейбла: «Забули пароль?», лічильник, «необов'язково». */
  'label-aside'?: () => unknown
}>()

const generatedId = useId()
const controlId = computed(() => props.id ?? `${generatedId}-control`)
const labelId = `${generatedId}-label`
const descriptionId = `${generatedId}-description`
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`

/*
 * aria-describedby: `description` + рівно ОДИН із пари помилка/підказка.
 * Обидва одразу — і скрінрідер зачитає інструкцію, яку користувач щойно
 * порушив, раніше за причину відмови (правило дому).
 */
const describedBy = computed(() => {
  const ids: string[] = []
  if (props.description) ids.push(descriptionId)
  if (props.error) ids.push(errorId)
  else if (props.hint) ids.push(hintId)
  return ids.length ? ids.join(' ') : undefined
})

/*
 * Лейбл стоїть у рядку разом із «label-aside», тож відступ під ним дає
 * рядок, а не сам лейбл. Прибираємо mb-* зі спільного labelClass, а не
 * дописуємо mb-0 поверх: два mb-* на одному елементі вирішує порядок у
 * згенерованому CSS, а не порядок у шаблоні.
 */
const labelTextClass = labelClass.replace(/\s*\bmb-\S+/g, '')

const slotProps = computed<FormFieldSlotProps>(() => ({
  id: controlId.value,
  labelId,
  describedBy: describedBy.value,
  invalid: !!props.error,
  required: props.required,
  disabled: props.disabled,
}))
</script>

<template>
  <component
    :is="as"
    class="min-w-0"
    :disabled="as === 'fieldset' ? disabled : undefined"
    :aria-describedby="as === 'fieldset' ? describedBy : undefined"
  >
    <!--
      <legend> зобов'язаний бути ПЕРШОЮ дитиною fieldset — лише тоді він дає
      групі назву. Вкладений у flex-рядок поруч із «label-aside», він назвою
      вже не був би. Тому легенда — прихована й перша, а видимий рядок
      поруч дублює її для ока (aria-hidden, щоб не звучало двічі).
    -->
    <legend v-if="as === 'fieldset' && label" :id="labelId" class="sr-only">
      {{ label }}{{ required ? ' (обов\'язково)' : '' }}
    </legend>

    <div v-if="label || $slots['label-aside']" class="mb-1 flex items-baseline justify-between gap-3">
      <span v-if="as === 'fieldset' && label" :class="labelTextClass" aria-hidden="true">
        {{ label }}<span v-if="required" class="text-danger"> *</span>
      </span>
      <label v-else-if="label" :id="labelId" :for="controlId" :class="labelTextClass">
        {{ label }}<span v-if="required" class="text-danger" aria-hidden="true"> *</span>
      </label>
      <span v-else />
      <span v-if="$slots['label-aside']" class="shrink-0 text-sm text-muted">
        <slot name="label-aside" />
      </span>
    </div>

    <p v-if="description" :id="descriptionId" class="-mt-0.5 mb-2 text-sm text-muted">{{ description }}</p>

    <slot v-bind="slotProps" />

    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </component>
</template>
