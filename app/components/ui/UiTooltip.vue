<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Текст підказки. Для складнішого вмісту є слот `content`. */
    content?: string
    /** Звідки з'являється підказка відносно тригера. */
    placement?: 'top' | 'bottom' | 'left' | 'right'
    /** Затримка показу, мс. */
    delay?: number
    disabled?: boolean
  }>(),
  { content: undefined, placement: 'top', delay: 200, disabled: false },
)

defineSlots<{
  /**
   * Тригер. Отримує `describedBy` — ПРОКИНЬТЕ його на інтерактивний
   * елемент усередині, інакше скрінрідер не зв'яже підказку з елементом.
   */
  default: (props: { describedBy: string | undefined }) => unknown
  /** Багатий вміст замість `content`. */
  content?: () => unknown
}>()

const wrapperEl = ref<HTMLElement | null>(null)
const tooltipEl = ref<HTMLElement | null>(null)
const visible = ref(false)
const style = ref<Record<string, string>>({})

const tooltipId = `${useId()}-tooltip`
const describedBy = ref<string | undefined>(undefined)

let timer: ReturnType<typeof setTimeout> | undefined

function show() {
  if (props.disabled || visible.value) return
  timer = setTimeout(() => {
    visible.value = true
    void nextTick(updatePosition)
  }, props.delay)
}

function hide() {
  if (timer) clearTimeout(timer)
  timer = undefined
  visible.value = false
  describedBy.value = undefined
}

function updatePosition() {
  const anchor = wrapperEl.value
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const w = tooltipEl.value?.offsetWidth ?? 120
  const h = tooltipEl.value?.offsetHeight ?? 30
  const gap = 6
  const edge = 8

  let top: number
  let left: number

  switch (props.placement) {
    case 'bottom':
      top = rect.bottom + gap
      left = rect.left + rect.width / 2 - w / 2
      break
    case 'left':
      top = rect.top + rect.height / 2 - h / 2
      left = rect.left - w - gap
      break
    case 'right':
      top = rect.top + rect.height / 2 - h / 2
      left = rect.right + gap
      break
    default:
      top = rect.top - h - gap
      left = rect.left + rect.width / 2 - w / 2
  }

  /*
   * Фліп на протилежний бік, коли свій не влазить. Умова перевіряє САМЕ
   * той бік, куди дивиться placement: «top» фліпається вниз, коли зверху
   * менше місця, ніж висота підказки (top < edge), а не коли підказка
   * вилазить за нижній край — інакше біля верхнього краю підказка
   * перекривала б тригер замість перевороту вниз.
   */
  if (props.placement === 'top' && top < edge) {
    top = rect.bottom + gap
  } else if (props.placement === 'bottom' && top + h > window.innerHeight - edge) {
    top = rect.top - h - gap
  }

  // Притискання до країв — останній шанс для вузьких вікон.
  if (top + h > window.innerHeight - edge) top = window.innerHeight - h - edge
  if (top < edge) top = edge
  if (left + w > window.innerWidth - edge) left = window.innerWidth - w - edge
  if (left < edge) left = edge

  style.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function onScrollOrResize() {
  if (visible.value) updatePosition()
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) hide()
}

// Панель у body — слухаємо документ, а не корінь.
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })
}

onBeforeUnmount(() => {
  hide()
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('resize', onScrollOrResize)
  }
})

// Перерахунок, коли панель нарешті має реальні габарити.
watch(tooltipEl, (el) => {
  if (el) {
    void nextTick(() => {
      updatePosition()
      describedBy.value = tooltipId
    })
  }
})
</script>

<template>
  <span
    ref="wrapperEl"
    class="inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot :described-by="describedBy" />

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="visible"
          :id="tooltipId"
          ref="tooltipEl"
          role="tooltip"
          class="pointer-events-none fixed z-[1100] max-w-64 rounded-control bg-ink px-2.5 py-1.5 text-xs leading-snug text-main shadow-overlay"
          :style="style"
        >
          <slot name="content">{{ content }}</slot>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>