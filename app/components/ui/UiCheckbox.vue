<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useId, watch } from 'vue'
import { errorTextClass, helperTextClass } from '~/utils/uiFieldStyles'

const props = withDefaults(
  defineProps<{
    /** Стан прапорця. Використовуйте через `v-model`. */
    modelValue?: boolean
    /** Візуальний і ARIA-стан часткового вибору. */
    indeterminate?: boolean
    label?: string
    /** Пояснення під міткою. Друкується дрібнішим і не замінює `label`. */
    description?: string
    disabled?: boolean
    required?: boolean
    /**
     * Текст помилки. Стан помилки вмикає САМА наявність тексту — булевого
     * прапорця немає навмисно, щоб не було червоного поля без пояснення
     * причини.
     */
    error?: string
    /**
     * Підказка під полем. Ховається, коли показано помилку:
     * `aria-describedby` має вказувати рівно на один опис.
     */
    hint?: string
    id?: string
    name?: string
    /** Значення, яке браузер серіалізує для checked checkbox. */
    value?: string | number
  }>(),
  { modelValue: false, indeterminate: false, value: 'on' },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

defineSlots<{
  /** Власний підпис замість `label`. */
  default?: (props: { checked: boolean; indeterminate: boolean }) => unknown
}>()

const generatedId = useId()
const checkboxId = computed(() => props.id ?? `${generatedId}-checkbox`)
const errorId = `${generatedId}-error`
const hintId = `${generatedId}-hint`
const descriptionId = `${generatedId}-description`
const inputEl = shallowRef<HTMLInputElement | null>(null)

const describedBy = computed(() => {
  const ids = []
  if (props.description) ids.push(descriptionId)
  if (props.error) ids.push(errorId)
  else if (props.hint) ids.push(hintId)
  return ids.length ? ids.join(' ') : undefined
})

function syncIndeterminate() {
  if (inputEl.value) inputEl.value.indeterminate = props.indeterminate
}

watch(() => props.indeterminate, () => void nextTick(syncIndeterminate))
onMounted(syncIndeterminate)

function onChange(event: Event) {
  const value = (event.target as HTMLInputElement).checked
  emit('update:modelValue', value)
  emit('change', value)
}

defineExpose({ focus: () => inputEl.value?.focus() })
</script>

<template>
  <div>
    <label
      :for="checkboxId"
      class="flex min-w-0 w-full items-start gap-2.5"
      :class="disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
    >
      <span class="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          :id="checkboxId"
          ref="inputEl"
          type="checkbox"
          :name="name"
          :value="value"
          :checked="modelValue"
          :disabled="disabled"
          :required="required"
          :aria-checked="indeterminate ? 'mixed' : modelValue"
          :aria-invalid="!!error || undefined"
          :aria-describedby="describedBy"
          class="peer h-5 w-5 appearance-none rounded-[0.3rem] border border-line bg-input transition-[border-color,background-color,box-shadow] not-disabled:hover:border-line-strong checked:border-accent-solid checked:bg-accent-solid checked:not-disabled:hover:border-accent-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
          @change="onChange"
        />
        <!-- animate-check-in: галочка «виростає», а не вмикається — стан
             змінився помітно, але за 180 мс. -->
        <svg
          v-if="modelValue && !indeterminate"
          class="pointer-events-none absolute h-3.5 w-3.5 text-accent-contrast animate-check-in"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span
          v-else-if="indeterminate"
          class="pointer-events-none absolute h-0.5 w-2.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-medium text-ink">
          <slot :checked="modelValue" :indeterminate="indeterminate">{{ label }}</slot>
          <span v-if="required" class="text-danger" aria-hidden="true"> *</span>
        </span>
        <span v-if="description" :id="descriptionId" class="mt-0.5 block text-xs text-muted">
          {{ description }}
        </span>
      </span>
    </label>
    <p v-if="error" :id="errorId" :class="errorTextClass" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
