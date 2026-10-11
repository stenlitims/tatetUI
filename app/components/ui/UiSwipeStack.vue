<script setup lang="ts">
import { ref, toRef } from 'vue'
import { useSwipeStack } from '~/composables/useSwipeStack'

const props = withDefaults(
  defineProps<{
    /** Верхній екран відкрито: він в'їжджає справа поверх нижнього. */
    open?: boolean
    /**
     * Свайп праворуч з будь-якого місця верхнього екрана повертає назад.
     * Вимкніть для екрана, що сам обробляє горизонтальні жести (полотно,
     * карта) — з таких елементів жест і так не починається.
     */
    swipe?: boolean
    /** На скільки (% ширини) нижній екран відступає під верхній. */
    parallax?: number
    /** Класи нижнього екрана — тло й розкладка вмісту. */
    baseClass?: string
    /** Класи верхнього екрана — тло й розкладка вмісту. */
    pageClass?: string
  }>(),
  { open: false, swipe: true, parallax: 28, baseClass: 'bg-card', pageClass: 'bg-card' },
)

const emit = defineEmits<{
  back: []
}>()

defineSlots<{
  /**
   * Нижній екран — корінь стеку (список). Лишається змонтованим під
   * верхнім: повернення миттєве, прокрутка й пошук на місці.
   */
  base?: () => unknown
  /** Верхній екран (деталі). Рендериться, поки `open`. */
  page?: () => unknown
}>()

const pageEl = ref<HTMLElement | null>(null)
const stack = useSwipeStack({
  open: toRef(props, 'open'),
  pageEl,
  canStart: () => props.swipe,
  back: () => emit('back'),
  parallax: props.parallax,
})

defineExpose({
  /** Скинути стан жесту — наприклад, коли батько закрив екран сам. */
  reset: stack.reset,
})
</script>

<template>
  <div class="relative overflow-clip">
    <!-- inert: поки зверху інший екран, до нижнього не дістають ні Tab, ні скрінрідер. -->
    <div
      class="absolute inset-0 flex flex-col"
      :class="[baseClass, stack.underHidden.value ? 'invisible' : '']"
      :style="stack.underStyle.value"
      :inert="open"
    >
      <slot name="base" />
      <div class="absolute inset-0" :style="stack.dimStyle.value" aria-hidden="true" />
    </div>

    <Transition v-bind="stack.transition">
      <div
        v-if="open"
        ref="pageEl"
        data-swipe-stack-page
        class="absolute inset-0 flex flex-col"
        :class="pageClass"
        :style="stack.pageStyle.value"
      >
        <slot name="page" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/*
 * Свайп «назад» починається й над областями прокрутки. Кожна з них знову
 * вмикає панорамування для своїх дітей, тож pan-y з екрана до них не
 * доходить — інакше браузер забирав би горизонтальний рух собі.
 * Горизонтальні (код, вкладки) не зачіпаємо: там палець прокручує вбік.
 */
[data-swipe-stack-page] :deep(.overflow-y-auto) {
  touch-action: pan-y pinch-zoom;
}
</style>
