<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Прогрес 0–max. `null` — невизначений стан (смуга бігає). */
    modelValue?: number | null
    /** Максимум шкали. */
    max?: number
    /** Товщина смуги. */
    size?: 'sm' | 'md'
    /** Доступна назва. Обов'язкова, якщо поруч немає видимого підпису. */
    label?: string
    /** Показати числове значення праворуч від підпису. */
    showValue?: boolean
  }>(),
  { modelValue: null, max: 100, size: 'sm', label: undefined, showValue: false },
)

defineSlots<Record<string, never>>()

const normalizedMax = computed(() =>
  Number.isFinite(props.max) && props.max > 0 ? props.max : 100,
)

const normalizedValue = computed(() => {
  if (props.modelValue == null) return null
  if (!Number.isFinite(props.modelValue)) return 0
  return Math.min(Math.max(props.modelValue, 0), normalizedMax.value)
})

const percent = computed(() => {
  if (normalizedValue.value == null) return null
  return Math.round((normalizedValue.value / normalizedMax.value) * 100)
})
</script>

<template>
  <div>
    <div v-if="label || showValue" class="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
      <span v-if="label">{{ label }}</span>
      <span v-if="showValue && percent != null" class="tabular-nums">{{ percent }}%</span>
    </div>
    <div
      role="progressbar"
      :aria-label="label ?? undefined"
      :aria-valuemin="0"
      :aria-valuemax="normalizedMax"
      :aria-valuenow="normalizedValue ?? undefined"
      class="w-full overflow-hidden rounded-full bg-line"
      :class="size === 'md' ? 'h-2.5' : 'h-1.5'"
    >
      <div
        v-if="percent == null"
        class="ui-progress-indeterminate h-full w-1/3 rounded-full bg-accent-solid"
      />
      <div
        v-else
        class="h-full rounded-full bg-accent-solid transition-[width] duration-300"
        :style="{ width: `${percent}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
@keyframes ui-progress-slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(300%);
  }
}

.ui-progress-indeterminate {
  animation: ui-progress-slide 1.4s ease-in-out infinite;
}

/*
 * Глобальний reduced-motion вимикає анімацію тривалістю 0.01ms — без
 * явного фолбеку смуга застигла б за межами контейнера (translateX(-100%))
 * і прогрес «зникав» би. Тому тут стан вимкнених анімацій описано явно.
 */
@media (prefers-reduced-motion: reduce) {
  .ui-progress-indeterminate {
    animation: none;
    width: 100%;
    opacity: 0.5;
  }
}
</style>
