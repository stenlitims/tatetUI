<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  watch,
} from 'vue'
import { computeTooltipPosition } from '~/utils/tooltip'
import { getOverlayChildZIndex } from '~/utils/overlayPosition'

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

const ORIGIN: Record<NonNullable<typeof props.placement>, string> = {
  top: 'origin-bottom',
  bottom: 'origin-top',
  left: 'origin-right',
  right: 'origin-left',
}

const wrapperEl = ref<HTMLElement | null>(null)
const tooltipEl = ref<HTMLElement | null>(null)
const visible = ref(false)
const style = ref<Record<string, string>>({})

const tooltipId = `${useId()}-tooltip`
const describedBy = ref<string | undefined>(undefined)
const teleportReady = shallowRef(false)

let timer: ReturnType<typeof setTimeout> | undefined

function show() {
  if (props.disabled || visible.value || timer) return
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

  // Фліп по обох осях і притискання до країв — в utils/tooltip: чиста
  // функція, щоб поведінку перевіряв тест, а не рендер.
  const { top, left } = computeTooltipPosition(
    rect,
    { width: w, height: h },
    { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
    props.placement,
  )

  style.value = {
    top: `${top}px`,
    left: `${left}px`,
    zIndex: String(getOverlayChildZIndex(anchor)),
  }
}

function onScrollOrResize() {
  if (visible.value) updatePosition()
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) hide()
}

// Панель у body — слухаємо документ, а не корінь.
onMounted(() => {
  teleportReady.value = true
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })
})

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) hide()
  },
)

onBeforeUnmount(() => {
  hide()
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', onKeyDown, true)
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

    <Teleport to="body" :disabled="!teleportReady">
      <!-- Підказка «виростає» з боку тригера: origin залежить від placement,
           інакше масштабування від центру виглядає як спалах на місці. -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-95 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-if="visible"
          :id="tooltipId"
          ref="tooltipEl"
          role="tooltip"
          class="pointer-events-none fixed max-w-64 rounded-control bg-ink px-2.5 py-1.5 text-xs leading-snug text-main shadow-overlay"
          :class="ORIGIN[placement]"
          :style="style"
        >
          <slot name="content">{{ content }}</slot>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>
