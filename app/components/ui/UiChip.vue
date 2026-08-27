<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Смисловий колір. Кожен тон бере трійку токенів: текст / фон / межа. */
    tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
    size?: 'xs' | 'sm'
    /**
     * Робить чип інтерактивним: рендериться як `button`, отримує роль і
     * стає доступним із клавіатури.
     */
    clickable?: boolean
    /** Доступна назва. Потрібна, коли чип показує лише крапку чи іконку. */
    label?: string
    title?: string
    /** Кольорова крапка замість іконки — компактний індикатор статусу. */
    dot?: boolean
  }>(),
  { tone: 'neutral', size: 'xs' },
)

const emit = defineEmits<{
  /** Клік. Спрацьовує лише коли задано `clickable`. */
  click: [event: MouseEvent]
}>()

defineSlots<{
  /** Текст чипа. */
  default?: () => unknown
  /** Іконка перед текстом. Ігнорується, якщо задано `dot`. */
  icon?: () => unknown
}>()

const tones: Record<NonNullable<typeof props.tone>, string> = {
  accent: 'bg-primary-50 border-primary-200 text-accent',
  success: 'bg-success-bg border-success-line text-success',
  warning: 'bg-warning-bg border-warning-line text-warning',
  danger: 'bg-danger-bg border-danger-line text-danger',
  info: 'bg-info-bg border-info-line text-info',
  neutral: 'bg-neutral-bg border-neutral-line text-neutral',
}

const sizes: Record<NonNullable<typeof props.size>, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-1',
  sm: 'px-2 py-1 text-xs gap-1.5',
}

const classes = computed(() => [
  'inline-flex items-center rounded-full border font-medium leading-none whitespace-nowrap',
  tones[props.tone],
  sizes[props.size],
  props.clickable
    ? 'cursor-pointer transition-[filter] hover:brightness-95 dark:hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    : '',
])
</script>

<template>
  <!--
    Семантичний тег обирається за інтерактивністю, а не за виглядом.
    Клікабельний чип мусить бути <button>: <div @click> недоступний із
    клавіатури й не має ролі для скрінрідера.
  -->
  <component
    :is="clickable ? 'button' : 'span'"
    :type="clickable ? 'button' : undefined"
    :class="classes"
    :aria-label="label"
    :title="title"
    @click="clickable && emit('click', $event)"
  >
    <span
      v-if="dot"
      class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      aria-hidden="true"
    />
    <slot v-else name="icon" />
    <slot />
  </component>
</template>
