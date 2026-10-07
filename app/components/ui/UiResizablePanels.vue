<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Розмір першої панелі у відсотках. Використовуйте через `v-model`. */
    modelValue?: number
    /** Вісь поділу: панелі поруч чи одна над одною. */
    direction?: 'horizontal' | 'vertical'
    /** Мінімальний розмір першої панелі у відсотках. */
    min?: number
    /** Максимальний розмір першої панелі у відсотках. */
    max?: number
    /** Крок зміни розміру стрілками з клавіатури. */
    step?: number
    disabled?: boolean
    /**
     * Ключ localStorage, під яким зберігається розмір між сесіями.
     *
     * Збережене значення читається один раз у onMounted і заявляється через
     * звичайний `update:modelValue`; запис відбувається лише після дії
     * користувача (drag або клавіатура) — сторонні зміни `modelValue`
     * збереженого значення не перезаписують. Значення — голе число, тож ключ
     * має бути версіонованим: зміна сенсу числа вимагає нового ключа,
     * а не «захисного» парсера.
     */
    storageKey?: string
    /** Клас першої панелі (`<section>`): напр. адаптивне приховування. */
    startClass?: string
    /** Клас другої панелі (`<section>`). */
    endClass?: string
    /** Клас роздільника: напр. прибрати його разом із прихованою панеллю. */
    separatorClass?: string
    /**
     * Вигляд роздільника. `band` — смуга 11px з лінією посередині (типово).
     * `line` — лише лінія 1px між панелями, як межа в застосунках-месенджерах;
     * зона захоплення лишається 12px (48px на дотику) — невидима, навколо лінії.
     */
    separatorStyle?: 'band' | 'line'
    /** Доступна назва першої панелі. */
    startLabel?: string
    /** Доступна назва другої панелі. */
    endLabel?: string
    /**
     * Доступна назва роздільника. Він оголошений як `separator` з
     * `aria-valuenow`, тож без назви скрінрідер зачитає лише відсоток.
     */
    separatorLabel?: string
  }>(),
  {
    modelValue: undefined,
    direction: 'horizontal',
    min: 20,
    max: 80,
    step: 5,
    disabled: false,
    storageKey: undefined,
    startClass: undefined,
    endClass: undefined,
    separatorClass: undefined,
    separatorStyle: 'band',
    startLabel: 'Перша панель',
    endLabel: 'Друга панель',
    separatorLabel: 'Змінити розмір панелей',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()

defineSlots<{
  /** Вміст першої панелі. `size` — її поточний розмір у відсотках. */
  start?: (props: { size: number }) => unknown
  /** Вміст другої панелі. `size` — розмір ПЕРШОЇ панелі у відсотках. */
  end?: (props: { size: number }) => unknown
}>()

const rootEl = ref<HTMLElement | null>(null)
const dragging = shallowRef(false)
const bounds = computed(() => {
  const min = Math.max(0, Math.min(100, props.min))
  const max = Math.max(min, Math.min(100, props.max))
  return { min, max }
})

/*
 * Внутрішній стан для некерованого вживання (без `v-model`): останнє
 * значення, яке компонент обчислив сам — з drag, клавіатури або storage.
 * Керований `modelValue` завжди має пріоритет.
 */
const internalValue = ref<number | null>(null)

const value = computed(() => {
  const raw = props.modelValue ?? internalValue.value ?? 50
  return Math.max(bounds.value.min, Math.min(bounds.value.max, Number.isFinite(raw) ? raw : 50))
})
const safeStep = computed(() => Number.isFinite(props.step) && props.step > 0 ? props.step : 1)
const isHorizontal = computed(() => props.direction === 'horizontal')
const rootClass = computed(() => isHorizontal.value ? 'flex-row' : 'flex-col')
// `separatorSizeClass`, не `separatorClass`: prop із тим самим ім'ям має
// потрапити в шаблон без тіні — у контексті рендера setup-зв'язування
// перебивають props з однаковою назвою.
//
// Видимий роздільник — 11px: пальцем у нього не влучити, і на телефоні
// панелі фактично не розсувались. На coarse-вказівнику ціль розширює
// невидима смуга 45px уздовж роздільника (якір — relative на ньому).
const separatorSizeClass = computed(() => {
  const line = props.separatorStyle === 'line'
  if (isHorizontal.value) {
    return line
      ? "w-px cursor-col-resize after:absolute after:inset-y-0 after:-left-1.5 after:w-3 after:content-[''] pointer-coarse:after:-left-6 pointer-coarse:after:w-12"
      : "w-3 cursor-col-resize before:h-full before:w-px pointer-coarse:after:absolute pointer-coarse:after:inset-y-0 pointer-coarse:after:left-1/2 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:content-['']"
  }
  return line
    ? "h-px cursor-row-resize after:absolute after:inset-x-0 after:-top-1.5 after:h-3 after:content-[''] pointer-coarse:after:-top-6 pointer-coarse:after:h-12"
    : "h-3 cursor-row-resize before:h-px before:w-full pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-12 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
})
// Колір роздільника — одна гілка, один набір класів: у `band` фарбується лінія
// (`before:`), у `line` — сам елемент. Перетягування й наведення — акцентні.
const separatorToneClass = computed(() => {
  if (props.separatorStyle === 'line') {
    return dragging.value
      ? 'bg-accent-solid'
      : 'bg-line transition-colors hover:bg-accent-solid focus-visible:bg-accent-solid'
  }
  return [
    'bg-subtle before:block before:transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    dragging.value ? 'before:bg-accent-solid' : 'before:bg-line hover:before:bg-accent-solid',
  ].join(' ')
})
const handleToneClass = computed(() => (dragging.value ? 'opacity-100 bg-accent-solid' : 'bg-line-strong opacity-0'))
const startStyle = computed(() => ({ flexBasis: `${value.value}%` }))

function commit(nextValue: number, final = false) {
  const normalized = Math.round(Math.max(bounds.value.min, Math.min(bounds.value.max, nextValue)) * 100) / 100
  internalValue.value = normalized
  if (normalized !== props.modelValue) emit('update:modelValue', normalized)
  if (final) {
    emit('change', normalized)
    persist(normalized)
  }
}

/* ---------------------------------------------------------------- */
/*  Збереження розміру між сесіями                                  */
/* ---------------------------------------------------------------- */

function persist(nextValue: number) {
  if (!props.storageKey || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(props.storageKey, String(nextValue))
  }
  catch {
    // Storage недоступний (private mode, quota) — розмір живе до перезавантаження.
  }
}

/**
 * Збережене значення читається в onMounted, а не в setup: у setup воно
 * змусило б клієнт відрендеритись інакше, ніж сервер (hydration mismatch).
 */
onMounted(() => {
  if (!props.storageKey || typeof window === 'undefined') return
  let saved: number | null = null
  try {
    const raw = window.localStorage.getItem(props.storageKey)
    const parsed = raw == null ? Number.NaN : Number.parseFloat(raw)
    saved = Number.isFinite(parsed) ? parsed : null
  }
  catch {
    saved = null
  }
  if (saved == null) return
  const next = Math.max(bounds.value.min, Math.min(bounds.value.max, saved))
  if (next === value.value) return
  internalValue.value = next
  // Керований вживач дізнається про відновлений розмір через звичайний
  // update:modelValue — окремої події відновлення не потрібно.
  if (props.modelValue !== undefined) emit('update:modelValue', next)
})

/* ---------------------------------------------------------------- */
/*  Pointer resize                                                  */
/* ---------------------------------------------------------------- */

function valueFromPointer(event: PointerEvent) {
  const rect = rootEl.value?.getBoundingClientRect()
  if (!rect) return value.value
  const ratio = isHorizontal.value
    ? (event.clientX - rect.left) / Math.max(1, rect.width)
    : (event.clientY - rect.top) / Math.max(1, rect.height)
  return ratio * 100
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  event.preventDefault()
  commit(valueFromPointer(event))
}

function stopDragging(event?: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  commit(event ? valueFromPointer(event) : value.value, true)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stopDragging)
  window.removeEventListener('pointercancel', stopDragging)
}

function startDragging(event: PointerEvent) {
  if (props.disabled) return
  event.preventDefault()
  dragging.value = true
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopDragging)
  window.addEventListener('pointercancel', stopDragging)
}

/* ---------------------------------------------------------------- */
/*  Клавіатура                                                      */
/* ---------------------------------------------------------------- */

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  let next = value.value
  const decrement = isHorizontal.value ? 'ArrowLeft' : 'ArrowUp'
  const increment = isHorizontal.value ? 'ArrowRight' : 'ArrowDown'
  if (event.key === decrement) next -= safeStep.value
  else if (event.key === increment) next += safeStep.value
  else if (event.key === 'Home') next = bounds.value.min
  else if (event.key === 'End') next = bounds.value.max
  else return
  event.preventDefault()
  commit(next, true)
}

// Значення поза межами підтягується назад — баунди можуть змінитись пропсами.
watch([bounds, () => props.modelValue], () => {
  if (props.modelValue === undefined) return
  if (value.value !== props.modelValue) emit('update:modelValue', value.value)
}, { immediate: true })

onBeforeUnmount(() => stopDragging())
</script>

<template>
  <!--
    h-full + w-full на корені — контракт «заповни батька». Без явної ширини
    компонент у flex-батьку мірявся контентом (порожній хвіст праворуч),
    а без висоти — рендерився «стиснуто» в обгортці з фіксованою висотою.
  -->
  <div ref="rootEl" class="flex h-full w-full min-h-0 min-w-0 overflow-hidden" :class="rootClass">
    <section :aria-label="startLabel" class="min-h-0 min-w-0 overflow-auto" :class="startClass" :style="startStyle">
      <slot name="start" :size="value" />
    </section>

    <div
      role="separator"
      :aria-label="separatorLabel"
      :aria-orientation="isHorizontal ? 'vertical' : 'horizontal'"
      :aria-valuemin="bounds.min"
      :aria-valuemax="bounds.max"
      :aria-valuenow="value"
      :aria-disabled="disabled ? 'true' : undefined"
      :tabindex="disabled ? -1 : 0"
      class="group relative z-10 flex shrink-0 touch-none items-center justify-center outline-none"
      :class="[separatorSizeClass, separatorToneClass, separatorClass, { 'cursor-not-allowed opacity-50': disabled }]"
      @pointerdown="startDragging"
      @keydown="onKeydown"
    >
      <!-- Ручка: пігулка, що проявляється на наведенні й під час
           перетягування. Лінія сама по собі не каже, що її можна тягнути. -->
      <span
        aria-hidden="true"
        class="absolute rounded-full transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        :class="[isHorizontal ? 'h-8 w-1' : 'h-1 w-8', handleToneClass]"
      />
      <span class="sr-only">{{ Math.round(value) }}%</span>
    </div>

    <section :aria-label="endLabel" class="min-h-0 min-w-0 flex-1 overflow-auto" :class="endClass">
      <slot name="end" :size="100 - value" />
    </section>
  </div>
</template>