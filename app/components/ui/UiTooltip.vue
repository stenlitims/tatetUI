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
import { useFloatingLayer } from '~/composables/useOverlayStack'
import { computeTooltipPosition } from '~/utils/tooltip'
import { getOverlayChildZIndex } from '~/utils/overlayPosition'

const props = withDefaults(
  defineProps<{
    /** Текст підказки. Для складнішого вмісту є слот `content`. */
    content?: string
    /** Звідки з'являється підказка відносно тригера. */
    placement?: 'top' | 'bottom' | 'left' | 'right'
    /** Затримка показу при наведенні, мс. Фокус із клавіатури показує одразу. */
    delay?: number
    /**
     * Скільки чекати, перш ніж сховати підказку, коли курсор пішов із
     * тригера, мс. Цього вистачає, щоб перевести курсор на саму підказку й
     * дочитати її.
     */
    closeDelay?: number
    disabled?: boolean
  }>(),
  { content: undefined, placement: 'top', delay: 200, closeDelay: 100, disabled: false },
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

let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let overTrigger = false
let overTooltip = false
/** Фокус із клавіатури всередині тригера: поки він там, підказка не ховається. */
let keyboardFocus = false

/*
 * Пасивний шар: Escape спершу ховає підказку і далі не йде — раніше той
 * самий натиск закривав ще й модалку під нею разом із формою. Водночас
 * `isTopmost` оверлея під підказкою не змінюється: стрілки в галереї
 * гортають, поки над кнопкою висить підказка.
 */
const layer = useFloatingLayer({
  elements: () => [wrapperEl.value, tooltipEl.value],
  onEscape: () => hide(),
  onPointerDownOutside: () => hide(),
  passive: true,
})

function clearTimers() {
  if (showTimer) clearTimeout(showTimer)
  if (hideTimer) clearTimeout(hideTimer)
  showTimer = undefined
  hideTimer = undefined
}

function show() {
  clearTimers()
  if (props.disabled) return
  if (!visible.value) {
    visible.value = true
    layer.activate()
  }
  // describedBy — у тому ж такті, що й показ: скрінрідер читає опис одразу
  // після події фокуса, і атрибут, що з'явився пізніше, вже не оголосить.
  describedBy.value = tooltipId
  void nextTick(updatePosition)
}

function hide() {
  clearTimers()
  overTooltip = false
  keyboardFocus = false
  describedBy.value = undefined
  if (!visible.value) return
  visible.value = false
  layer.deactivate()
}

function onTriggerEnter() {
  overTrigger = true
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }
  if (props.disabled || visible.value || showTimer) return
  showTimer = setTimeout(show, props.delay)
}

function onTriggerLeave() {
  overTrigger = false
  scheduleHide()
}

/**
 * Не ховаємо одразу: між тригером і підказкою є зазор, і курсор, що йде на
 * неї, на мить не над жодним із них. Без паузи підказку неможливо навести,
 * а WCAG 1.4.13 вимагає, щоб її можна було навести й дочитати.
 */
function scheduleHide() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = undefined
  }
  if (!visible.value || keyboardFocus || hideTimer) return
  hideTimer = setTimeout(() => {
    hideTimer = undefined
    if (!overTrigger && !overTooltip && !keyboardFocus) hide()
  }, props.closeDelay)
}

function onTooltipEnter() {
  overTooltip = true
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }
}

function onTooltipLeave() {
  overTooltip = false
  scheduleHide()
}

/**
 * Фокус із клавіатури показує підказку ОДРАЗУ, без затримки наведення:
 * інакше скрінрідер встигав оголосити кнопку раніше, ніж з'являвся її опис.
 * Фокус від кліку мишею (не :focus-visible) нічого не показує — підказка
 * вистрибувала б на кожне натискання.
 */
function onFocusIn(event: FocusEvent) {
  if (props.disabled) return
  const target = event.target
  if (!(target instanceof Element)) return
  let fromKeyboard = true
  try {
    fromKeyboard = target.matches(':focus-visible')
  } catch {
    // Браузер без :focus-visible — показуємо, як і раніше, на будь-який фокус.
  }
  if (!fromKeyboard) return
  keyboardFocus = true
  show()
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && wrapperEl.value?.contains(next)) return
  keyboardFocus = false
  if (!overTrigger && !overTooltip) hide()
}

/** Натискання ховає підказку: людина вже діє, підказка лише заступає результат. */
function onPointerDown() {
  hide()
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

// Панель у body — слухаємо вікно, а не корінь.
onMounted(() => {
  teleportReady.value = true
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
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('resize', onScrollOrResize)
  }
})

// Перерахунок, коли панель нарешті має реальні габарити.
watch(tooltipEl, (el) => {
  if (el) void nextTick(updatePosition)
})
</script>

<template>
  <span
    ref="wrapperEl"
    class="inline-flex"
    @mouseenter="onTriggerEnter"
    @mouseleave="onTriggerLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @pointerdown="onPointerDown"
  >
    <slot :described-by="describedBy" />

    <Teleport to="body" :disabled="!teleportReady">
      <!-- Підказка «виростає» з боку тригера: origin залежить від placement,
           інакше масштабування від центру виглядає як спалах на місці. -->
      <Transition
        enter-active-class="transition duration-(--duration-base) ease-out"
        enter-from-class="scale-95 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-(--duration-fast) ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-if="visible"
          :id="tooltipId"
          ref="tooltipEl"
          role="tooltip"
          class="fixed max-w-64 rounded-control bg-ink px-2.5 py-1.5 text-xs leading-snug text-main shadow-overlay"
          :class="ORIGIN[placement]"
          :style="style"
          @mouseenter="onTooltipEnter"
          @mouseleave="onTooltipLeave"
        >
          <slot name="content">{{ content }}</slot>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>
