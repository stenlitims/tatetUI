<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Вісь прокрутки. `both` вмикає обидві одразу. */
    orientation?: 'vertical' | 'horizontal' | 'both'
    /** Фіксована висота області — будь-яка CSS-величина. */
    height?: string
    /** Стеля висоти: область росте за вмістом, доки не впреться. */
    maxHeight?: string
    /** Доступне ім'я області. Її оголошено як `region`, тож ім'я обов'язкове. */
    ariaLabel?: string
    /**
     * Допуск у пікселях, у межах якого край вважається досягнутим.
     *
     * Нуль не годиться: при дробовому масштабуванні сторінки
     * scrollTop + clientHeight ніколи точно не дорівнює scrollHeight, і
     * подія `reachEnd` не спрацьовувала б узагалі.
     */
    edgeThreshold?: number
    /**
     * tabindex області. Нуль лишає її доступною з клавіатури — без цього
     * прокрутити вміст без миші неможливо.
     */
    tabindex?: number
  }>(),
  {
    orientation: 'vertical',
    ariaLabel: 'Прокручувана область',
    edgeThreshold: 1,
    tabindex: 0,
  },
)

const emit = defineEmits<{
  scroll: [event: Event]
  reachStart: []
  reachEnd: []
}>()

defineSlots<{
  /**
   * Вміст області. Отримує стан країв, щоб споживач міг показати власну
   * підказку «є що прокручувати» замість типового градієнта.
   */
  default?: (props: { atStart: boolean; atEnd: boolean }) => unknown
}>()

const viewportEl = ref<HTMLElement | null>(null)
const atStart = shallowRef(true)
const atEnd = shallowRef(false)
let observer: ResizeObserver | null = null
let contentObserver: MutationObserver | null = null

const overflowClass = computed(() => ({
  vertical: 'overflow-x-hidden overflow-y-auto',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
}[props.orientation]))

const areaStyle = computed(() => ({ height: props.height, maxHeight: props.maxHeight }))

function metrics() {
  const element = viewportEl.value
  if (!element) return { start: true, end: true }
  const threshold = Math.max(0, props.edgeThreshold)
  if (props.orientation === 'horizontal') {
    return {
      start: element.scrollLeft <= threshold,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - threshold,
    }
  }
  return {
    start: element.scrollTop <= threshold,
    end: element.scrollTop + element.clientHeight >= element.scrollHeight - threshold,
  }
}

function updateEdges(announce = false) {
  const previousStart = atStart.value
  const previousEnd = atEnd.value
  const state = metrics()
  atStart.value = state.start
  atEnd.value = state.end
  if (announce && state.start && !previousStart) emit('reachStart')
  if (announce && state.end && !previousEnd) emit('reachEnd')
}

function onScroll(event: Event) {
  updateEdges(true)
  emit('scroll', event)
}

function scrollTo(options: ScrollToOptions) {
  viewportEl.value?.scrollTo(options)
}

function scrollToStart(behavior: ScrollBehavior = 'smooth') {
  viewportEl.value?.scrollTo(props.orientation === 'horizontal' ? { left: 0, behavior } : { top: 0, behavior })
}

function scrollToEnd(behavior: ScrollBehavior = 'smooth') {
  const element = viewportEl.value
  if (!element) return
  element.scrollTo(props.orientation === 'horizontal'
    ? { left: element.scrollWidth, behavior }
    : { top: element.scrollHeight, behavior })
}

watch(() => [props.orientation, props.height, props.maxHeight], () => nextTick(updateEdges))

/*
 * Спостерігаємо за viewport і за його поточною дитиною.
 *
 * Раніше дитина бралася один раз в onMounted. Якщо корінь вмісту слота
 * підмінявся (`v-if` на першому ж вузлі — звичайна річ для списку, що
 * вантажиться), новий вузол не спостерігався ніким, і стан країв застигав:
 * градієнт «є ще вміст» лишався там, де прокручувати вже нічого, або
 * зникав там, де ще є. MutationObserver перепідписує ResizeObserver на
 * фактичну дитину.
 */
function observeContent() {
  const viewport = viewportEl.value
  if (!observer || !viewport) return
  observer.disconnect()
  observer.observe(viewport)
  if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
  updateEdges()
}

onMounted(() => {
  updateEdges()
  if (typeof ResizeObserver !== 'undefined' && viewportEl.value) {
    observer = new ResizeObserver(() => updateEdges())
    observeContent()
  }
  if (typeof MutationObserver !== 'undefined' && viewportEl.value) {
    contentObserver = new MutationObserver(observeContent)
    contentObserver.observe(viewportEl.value, { childList: true })
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  contentObserver?.disconnect()
})

defineExpose({ viewportEl, atStart, atEnd, scrollTo, scrollToStart, scrollToEnd })
</script>

<template>
  <div class="relative min-h-0 min-w-0">
    <div
      ref="viewportEl"
      role="region"
      :aria-label="ariaLabel"
      :tabindex="tabindex"
      class="scrollbar-thin min-h-0 min-w-0 rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :class="overflowClass"
      :style="areaStyle"
      @scroll="onScroll"
    >
      <slot :at-start="atStart" :at-end="atEnd" />
    </div>
    <div
      v-if="!atStart"
      aria-hidden="true"
      class="pointer-events-none absolute from-card to-transparent"
      :class="orientation === 'horizontal'
        ? 'inset-y-0 left-0 w-4 bg-gradient-to-r'
        : 'inset-x-0 top-0 h-4 bg-gradient-to-b'"
    />
    <div
      v-if="!atEnd"
      aria-hidden="true"
      class="pointer-events-none absolute from-card to-transparent"
      :class="orientation === 'horizontal'
        ? 'inset-y-0 right-0 w-4 bg-gradient-to-l'
        : 'inset-x-0 bottom-0 h-4 bg-gradient-to-t'"
    />
  </div>
</template>
