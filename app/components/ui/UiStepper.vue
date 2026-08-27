<script setup lang="ts">
import { computed } from 'vue'

export interface StepItem {
  id: string
  label: string
  description?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Кроки майстра. */
    steps: StepItem[]
    /** Поточний крок (0-based). Використовуйте через `v-model`. */
    modelValue?: number
    /**
     * Режим кліків. `any` — клік по будь-якому кроку; `visited` — лише по
     * вже пройдених (і на крок вперед); `none` — клікати не можна, тільки
     * Next/Back у споживача.
     */
    clickMode?: 'any' | 'visited' | 'none'
    /** Ховати заголовки — лишаються тільки кружечки-індикатори. */
    compact?: boolean
  }>(),
  { modelValue: 0, clickMode: 'visited', compact: false },
)

const emit = defineEmits<{
  'update:modelValue': [step: number]
  /** Активний крок змінився. */
  change: [step: number]
}>()

defineSlots<{
  /** Власний рендер індикатора кроку: число, галочка, іконка. */
  indicator?: (props: { step: StepItem; index: number; state: 'done' | 'active' | 'upcoming' }) => unknown
  /** Власний рендер заголовка кроку. */
  label?: (props: { step: StepItem; state: 'done' | 'active' | 'upcoming' }) => unknown
}>()

const stateOf = (index: number): 'done' | 'active' | 'upcoming' =>
  index < props.modelValue ? 'done' : index === props.modelValue ? 'active' : 'upcoming'

// У режимі visited дозволено йти назад по пройдених і на один крок уперед.
const maxReachable = computed(() => Math.min(props.steps.length - 1, props.modelValue + 1))

function onStepClick(index: number) {
  const step = props.steps[index]
  if (!step || step.disabled) return
  if (props.clickMode === 'none' && index !== props.modelValue) return
  if (props.clickMode === 'visited' && index > maxReachable.value) return
  if (index === props.modelValue) return
  emit('update:modelValue', index)
  emit('change', index)
}

const stepClass = (index: number) => {
  const state = stateOf(index)
  return [
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
    state === 'done'
      ? 'border-accent-solid bg-accent-solid text-accent-contrast'
      : state === 'active'
        ? 'border-accent-solid bg-card text-accent'
        : 'border-line bg-card text-muted',
  ]
}
</script>

<template>
  <nav aria-label="Кроки" class="flex flex-wrap items-start gap-y-3">
    <template v-for="(step, index) in steps" :key="step.id">
      <div
        v-if="index > 0"
        class="flex h-8 items-center px-1.5"
        :class="compact ? 'px-1' : 'flex-1 min-w-6'"
        aria-hidden="true"
      >
        <span
          class="h-px w-full transition-colors"
          :class="index <= modelValue ? 'bg-accent-solid' : 'bg-line'"
        />
      </div>

      <button
        type="button"
        :disabled="step.disabled || (clickMode === 'none' && index !== modelValue)"
        class="group flex items-start gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset disabled:cursor-not-allowed"
        :class="step.disabled ? 'cursor-not-allowed opacity-50' : ''"
        :aria-current="index === modelValue ? 'step' : undefined"
        @click="onStepClick(index)"
      >
        <span :class="stepClass(index)">
          <slot name="indicator" :step="step" :index="index" :state="stateOf(index)">
            <svg v-if="stateOf(index) === 'done'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
            <span v-else>{{ index + 1 }}</span>
          </slot>
        </span>

        <span v-if="!compact" class="min-w-0">
          <span
            class="block text-sm font-medium leading-tight"
            :class="stateOf(index) === 'active' ? 'text-ink' : 'text-muted group-hover:text-ink'"
          >
            <slot name="label" :step="step" :state="stateOf(index)">{{ step.label }}</slot>
          </span>
          <span
            v-if="step.description && stateOf(index) !== 'upcoming'"
            class="mt-0.5 block text-xs text-muted"
          >
            {{ step.description }}
          </span>
        </span>
      </button>
    </template>
  </nav>
</template>