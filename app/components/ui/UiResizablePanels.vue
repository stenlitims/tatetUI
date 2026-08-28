<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: number
    direction?: 'horizontal' | 'vertical'
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    startLabel?: string
    endLabel?: string
    separatorLabel?: string
  }>(),
  {
    modelValue: 50,
    direction: 'horizontal',
    min: 20,
    max: 80,
    step: 5,
    disabled: false,
    startLabel: 'Перша панель',
    endLabel: 'Друга панель',
    separatorLabel: 'Змінити розмір панелей',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()

const rootEl = ref<HTMLElement | null>(null)
const dragging = shallowRef(false)
const bounds = computed(() => {
  const min = Math.max(0, Math.min(100, props.min))
  const max = Math.max(min, Math.min(100, props.max))
  return { min, max }
})
const value = computed(() => Math.max(bounds.value.min, Math.min(bounds.value.max, Number.isFinite(props.modelValue) ? props.modelValue : 50)))
const safeStep = computed(() => Number.isFinite(props.step) && props.step > 0 ? props.step : 1)
const isHorizontal = computed(() => props.direction === 'horizontal')
const rootClass = computed(() => isHorizontal.value ? 'flex-row' : 'flex-col')
const separatorClass = computed(() => isHorizontal.value
  ? 'w-3 cursor-col-resize before:h-full before:w-px'
  : 'h-3 cursor-row-resize before:h-px before:w-full')
const startStyle = computed(() => ({ flexBasis: `${value.value}%` }))

function commit(nextValue: number, final = false) {
  const normalized = Math.round(Math.max(bounds.value.min, Math.min(bounds.value.max, nextValue)) * 100) / 100
  if (normalized !== props.modelValue) emit('update:modelValue', normalized)
  if (final) emit('change', normalized)
}

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

watch([bounds, () => props.modelValue], () => {
  if (value.value !== props.modelValue) emit('update:modelValue', value.value)
}, { immediate: true })

onBeforeUnmount(() => stopDragging())
</script>

<template>
  <div ref="rootEl" class="flex min-h-0 min-w-0 overflow-hidden" :class="rootClass">
    <section :aria-label="startLabel" class="min-h-0 min-w-0 overflow-auto" :style="startStyle">
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
      class="group relative z-10 flex shrink-0 touch-none items-center justify-center bg-surface-muted outline-none before:block before:bg-line hover:before:bg-accent-solid focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      :class="[separatorClass, { 'cursor-not-allowed opacity-50': disabled, 'before:bg-accent-solid': dragging }]"
      @pointerdown="startDragging"
      @keydown="onKeydown"
    >
      <span class="sr-only">{{ Math.round(value) }}%</span>
    </div>

    <section :aria-label="endLabel" class="min-h-0 min-w-0 flex-1 overflow-auto">
      <slot name="end" :size="100 - value" />
    </section>
  </div>
</template>
