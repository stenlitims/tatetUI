<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** HTML-тег кореня: `section`, `article`, `li`… */
    as?: string
    /** Внутрішні відступи тіла. Шапка й підвал мають власні. */
    padding?: 'none' | 'sm' | 'md'
    /** Підйом при наведенні — для клікабельних карток. */
    hoverable?: boolean
  }>(),
  { as: 'div', padding: 'md', hoverable: false },
)

defineSlots<{
  /** Тіло картки. */
  default?: () => unknown
  /** Шапка з нижньою межею: заголовок, дії. */
  header?: () => unknown
  /** Підвал з верхньою межею: кнопки, метадані. */
  footer?: () => unknown
}>()

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
} as const
</script>

<template>
  <component
    :is="as"
    class="rounded-card border border-line bg-card shadow-card"
    :class="hoverable ? 'transition duration-150 hover:-translate-y-0.5 hover:shadow-raised' : ''"
  >
    <div v-if="$slots.header" class="border-b border-line px-4 py-3 sm:px-5">
      <slot name="header" />
    </div>
    <div :class="paddings[padding]">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-line px-4 py-3 sm:px-5">
      <slot name="footer" />
    </div>
  </component>
</template>