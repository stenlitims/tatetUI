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

/*
 * Бічні поля шапки й підвалу — з того самого `padding`, що й тіло. Раніше
 * вони завжди були px-4/sm:px-5, і з `padding="sm"` заголовок стояв на
 * 4–7.5px правіше за текст тіла під ним. `none` лишає звичайні поля: тіло
 * без відступу — це таблиця чи список зі своїми, і вони рівняються саме
 * на px-4/sm:px-5.
 */
const edgePaddings = {
  none: 'px-4 py-3 sm:px-5',
  sm: 'px-3 py-2.5',
  md: 'px-4 py-3 sm:px-5',
} as const
</script>

<template>
  <component
    :is="as"
    class="rounded-card border border-line bg-card shadow-card"
    :class="hoverable ? 'transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised active:translate-y-0 active:shadow-card' : ''"
  >
    <div v-if="$slots.header" class="border-b border-line" :class="edgePaddings[padding]">
      <slot name="header" />
    </div>
    <div :class="paddings[padding]">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-line" :class="edgePaddings[padding]">
      <slot name="footer" />
    </div>
  </component>
</template>