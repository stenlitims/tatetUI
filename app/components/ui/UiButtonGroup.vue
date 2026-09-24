<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /**
     * Доступна назва групи: «Форматування тексту», «Масштаб». Без неї
     * скрінрідер оголосить просто «група», і сенс сусідства кнопок зникне.
     */
    label?: string
    /** Напрям: у рядок чи стовпчиком (панель інструментів збоку полотна). */
    orientation?: 'horizontal' | 'vertical'
    /** Розтягнути на всю ширину батька: кнопки діляться порівну. */
    block?: boolean
  }>(),
  { label: undefined, orientation: 'horizontal', block: false },
)

defineSlots<{
  /**
   * Кнопки — ПРЯМІ діти групи (`UiButton`, посилання). Кути й шви
   * знімаються саме з них: обгортка навколо кнопки (напр. меню) розірвала б
   * групу, тож для «дія + варіанти» є `UiSplitButton`.
   */
  default?: () => unknown
}>()

/*
 * Шви — через селектори дітей, а не через props на кожній кнопці: група
 * лишається однією обгорткою навколо звичайних UiButton, і переставити
 * кнопки місцями можна без правки їхніх класів.
 *
 * -ml-px накладає сусідні межі в одну лінію 1px замість двох. z-index на
 * наведенні й фокусі піднімає поточну кнопку над сусідами — інакше межа
 * наведення і кільце фокуса ховалися б під сусідньою кнопкою з одного боку.
 */
const classes = computed(() => [
  'isolate [&>*]:relative [&>*:hover]:z-[1] [&>*:focus-visible]:z-[2]',
  // display — рівно один клас: inline-flex і flex разом вирішував би
  // порядок у згенерованому CSS, а не цей рядок.
  props.block ? 'flex w-full' : 'inline-flex',
  props.orientation === 'vertical'
    ? 'flex-col [&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none'
    : '[&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none',
  props.block && props.orientation === 'horizontal' ? '[&>*]:flex-1 [&>*]:justify-center' : '',
])
</script>

<template>
  <!-- role="group", а не toolbar: toolbar зобов'язує до стрілок і однієї
       зупинки Tab, а тут кожна кнопка — звичайна зупинка, як поза групою. -->
  <div role="group" :aria-label="label" :class="classes">
    <slot />
  </div>
</template>
