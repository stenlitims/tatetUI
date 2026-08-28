<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'

const props = withDefaults(
  defineProps<{
    items: T[]
    modelValue?: number
    loop?: boolean
    autoplay?: boolean
    interval?: number
    pauseOnHover?: boolean
    ariaLabel?: string
  }>(),
  {
    modelValue: 0,
    loop: false,
    autoplay: false,
    interval: 5000,
    pauseOnHover: true,
    ariaLabel: 'Карусель',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()

defineSlots<{
  slide: (props: { item: T; index: number; active: boolean }) => unknown
  previous?: (props: { disabled: boolean }) => unknown
  next?: (props: { disabled: boolean }) => unknown
}>()

const reducedMotion = useReducedMotion()
const hovering = shallowRef(false)
const focused = shallowRef(false)
const autoplayPaused = shallowRef(false)
const pointerStart = shallowRef<number | null>(null)
let timer: number | null = null

const count = computed(() => props.items.length)
const current = computed(() => count.value ? Math.max(0, Math.min(count.value - 1, Math.floor(props.modelValue))) : 0)
const previousDisabled = computed(() => count.value < 2 || (!props.loop && current.value === 0))
const nextDisabled = computed(() => count.value < 2 || (!props.loop && current.value === count.value - 1))
const shouldAutoplay = computed(() => props.autoplay && !autoplayPaused.value && !reducedMotion.value && count.value > 1 && !(props.pauseOnHover && hovering.value) && !focused.value)

function goTo(index: number) {
  if (!count.value) return
  let next = index
  if (props.loop) next = (index + count.value) % count.value
  else next = Math.max(0, Math.min(count.value - 1, index))
  if (next === current.value) return
  emit('update:modelValue', next)
  emit('change', next)
}

function previous() {
  if (!previousDisabled.value) goTo(current.value - 1)
}

function next() {
  if (!nextDisabled.value) goTo(current.value + 1)
}

function clearTimer() {
  if (timer === null) return
  window.clearInterval(timer)
  timer = null
}

function syncTimer() {
  clearTimer()
  if (!shouldAutoplay.value || typeof window === 'undefined') return
  timer = window.setInterval(() => {
    if (!props.loop && current.value === count.value - 1) goTo(0)
    else goTo(current.value + 1)
  }, Math.max(1000, props.interval))
}

function toggleAutoplay() {
  autoplayPaused.value = !autoplayPaused.value
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') previous()
  else if (event.key === 'ArrowRight') next()
  else if (event.key === 'Home') goTo(0)
  else if (event.key === 'End') goTo(count.value - 1)
  else return
  event.preventDefault()
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  pointerStart.value = event.clientX
}

function onPointerUp(event: PointerEvent) {
  if (pointerStart.value === null) return
  const distance = event.clientX - pointerStart.value
  pointerStart.value = null
  if (Math.abs(distance) < 40) return
  distance > 0 ? previous() : next()
}

watch([shouldAutoplay, () => props.interval], syncTimer)
watch([count, () => props.modelValue], () => {
  if (props.modelValue !== current.value) emit('update:modelValue', current.value)
}, { immediate: true })

onMounted(syncTimer)
onBeforeUnmount(clearTimer)

defineExpose({ previous, next, goTo, pause: () => { autoplayPaused.value = true }, play: () => { autoplayPaused.value = false } })
</script>

<template>
  <section
    role="region"
    aria-roledescription="carousel"
    :aria-label="ariaLabel"
    class="relative outline-none"
    tabindex="0"
    @keydown="onKeydown"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
    @focusin="focused = true"
    @focusout="focused = false"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="pointerStart = null"
  >
    <div :aria-live="shouldAutoplay ? 'off' : 'polite'" class="overflow-hidden rounded-overlay">
      <div
        v-for="(item, index) in items"
        v-show="index === current"
        :key="index"
        role="group"
        aria-roledescription="slide"
        :aria-label="`${index + 1} з ${count}`"
        :aria-hidden="index === current ? undefined : 'true'"
        :inert="index !== current"
      >
        <slot name="slide" :item="item" :index="index" :active="index === current" />
      </div>
    </div>

    <div v-if="count > 1" class="mt-3 flex items-center justify-between gap-3">
      <button
        type="button"
        :disabled="previousDisabled"
        aria-label="Попередній слайд"
        class="inline-flex min-h-10 items-center justify-center rounded-control border border-line px-3 text-sm font-medium text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        @click="previous"
      >
        <slot name="previous" :disabled="previousDisabled">←</slot>
      </button>

      <div class="flex items-center gap-2" role="group" aria-label="Вибір слайда">
        <button
          v-for="(_, index) in items"
          :key="index"
          type="button"
          class="size-3 rounded-full border border-line transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="index === current ? 'bg-accent-solid' : 'bg-surface-muted hover:bg-hover'"
          :aria-label="`Перейти до слайда ${index + 1}`"
          :aria-current="index === current ? 'true' : undefined"
          @click="goTo(index)"
        />
      </div>

      <button
        type="button"
        :disabled="nextDisabled"
        aria-label="Наступний слайд"
        class="inline-flex min-h-10 items-center justify-center rounded-control border border-line px-3 text-sm font-medium text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        @click="next"
      >
        <slot name="next" :disabled="nextDisabled">→</slot>
      </button>
    </div>

    <button
      v-if="autoplay && count > 1"
      type="button"
      class="mt-3 rounded-control px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :aria-label="autoplayPaused ? 'Продовжити автопрокрутку' : 'Призупинити автопрокрутку'"
      @click="toggleAutoplay"
    >
      {{ autoplayPaused ? 'Відтворити' : 'Пауза' }}
    </button>
  </section>
</template>
