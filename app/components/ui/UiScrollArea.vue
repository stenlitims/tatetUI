<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    orientation?: 'vertical' | 'horizontal' | 'both'
    height?: string
    maxHeight?: string
    ariaLabel?: string
    edgeThreshold?: number
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

const viewportEl = ref<HTMLElement | null>(null)
const atStart = shallowRef(true)
const atEnd = shallowRef(false)
let observer: ResizeObserver | null = null

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

onMounted(() => {
  updateEdges()
  if (typeof ResizeObserver !== 'undefined' && viewportEl.value) {
    observer = new ResizeObserver(() => updateEdges())
    observer.observe(viewportEl.value)
    if (viewportEl.value.firstElementChild) observer.observe(viewportEl.value.firstElementChild)
  }
})

onBeforeUnmount(() => observer?.disconnect())

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
      class="pointer-events-none absolute from-surface to-transparent"
      :class="orientation === 'horizontal'
        ? 'inset-y-0 left-0 w-4 bg-gradient-to-r'
        : 'inset-x-0 top-0 h-4 bg-gradient-to-b'"
    />
    <div
      v-if="!atEnd"
      aria-hidden="true"
      class="pointer-events-none absolute from-surface to-transparent"
      :class="orientation === 'horizontal'
        ? 'inset-y-0 right-0 w-4 bg-gradient-to-l'
        : 'inset-x-0 bottom-0 h-4 bg-gradient-to-t'"
    />
  </div>
</template>
