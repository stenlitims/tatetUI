<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { focusNextAfter, getTabbable } from '~/composables/useFocusTrap'
import { useFloatingLayer } from '~/composables/useOverlayStack'
import { computeAnchoredPanelPosition, getOverlayChildZIndex } from '~/utils/overlayPosition'

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /** Бажана позиція картки. Не вміщається — перевертається. */
    placement?: 'bottom-start' | 'bottom' | 'bottom-end' | 'top-start' | 'top' | 'top-end' | 'left' | 'right'
    /**
     * Затримка перед показом, мс. Без неї картка блимає при кожному
     * проході курсора повз посилання.
     */
    openDelay?: number
    /**
     * Затримка перед приховуванням, мс. Дає час довести курсор від
     * тригера до самої картки.
     */
    closeDelay?: number
    /** Ширина картки, будь-яка CSS-величина. */
    width?: string
    disabled?: boolean
    /** Доступна назва картки. */
    ariaLabel?: string
  }>(),
  {
    modelValue: false,
    placement: 'bottom-start',
    openDelay: 400,
    closeDelay: 250,
    width: '20rem',
    disabled: false,
    ariaLabel: 'Додаткова інформація',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: []
  close: []
}>()

defineSlots<{
  /**
   * Тригер (зазвичай посилання). `triggerAttrs` — через `v-bind`: у них
   * наведення, фокус і Tab, що веде у відкриту картку.
   */
  trigger: (props: {
    open: boolean
    triggerAttrs: {
      'aria-expanded': boolean
      'aria-controls': string | undefined
      'aria-describedby': string | undefined
      onMouseenter: (event: MouseEvent) => void
      onMouseleave: () => void
      onFocus: (event: FocusEvent) => void
      onBlur: () => void
      onKeydown: (event: KeyboardEvent) => void
    }
  }) => unknown
  /** Вміст картки. `close` ховає її. */
  default: (props: { close: () => void }) => unknown
}>()

const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const teleportReady = shallowRef(false)
const panelHovered = shallowRef(false)
const triggerFocused = shallowRef(false)
const position = shallowRef({ top: '0px', left: '0px', zIndex: '1100' })
const panelId = `${useId()}-hover-card`
let openTimer: number | null = null
let closeTimer: number | null = null

/*
 * Пасивний шар: Escape і клік «повз» закривають картку, але вона не
 * відбирає `isTopmost` у модалки чи галереї під собою — картка
 * з'являється від простого наведення, і стрілки там мають лишатися
 * робочими.
 */
const layer = useFloatingLayer({
  elements: () => [rootEl.value, triggerEl.value, panelEl.value],
  onEscape: () => {
    const focusInside = !!panelEl.value?.contains(document.activeElement)
    close()
    // Фокус був у картці, що зараз зникне, — повертаємо його на тригер.
    if (focusInside) triggerEl.value?.focus()
  },
  onPointerDownOutside: () => close(),
  passive: true,
})

const triggerAttrs = computed(() => ({
  'aria-expanded': props.modelValue,
  'aria-controls': props.modelValue ? panelId : undefined,
  'aria-describedby': props.modelValue ? panelId : undefined,
  onMouseenter: onTriggerMouseenter,
  onMouseleave: scheduleClose,
  onFocus: onTriggerFocus,
  onBlur: onTriggerBlur,
  onKeydown: onTriggerKeydown,
}))

function clearTimers() {
  if (openTimer !== null) window.clearTimeout(openTimer)
  if (closeTimer !== null) window.clearTimeout(closeTimer)
  openTimer = null
  closeTimer = null
}

function updatePosition() {
  const trigger = triggerEl.value
  if (!trigger || typeof window === 'undefined') return
  const rect = trigger.getBoundingClientRect()
  const point = computeAnchoredPanelPosition(
    rect,
    { width: panelEl.value?.offsetWidth || 320, height: panelEl.value?.offsetHeight || 160 },
    { width: window.innerWidth, height: window.innerHeight },
    props.placement,
  )
  position.value = {
    top: `${Math.round(point.top)}px`,
    left: `${Math.round(point.left)}px`,
    zIndex: String(getOverlayChildZIndex(trigger)),
  }
}

/*
 * Закрита картка не рахує нічого: слухачі прокрутки висять на кожному
 * екземплярі, і без цієї перевірки кожна картка, яку колись навели,
 * змушувала браузер перераховувати розкладку на кожен тік скролу.
 */
function onViewportChange() {
  if (props.modelValue) updatePosition()
}

async function open() {
  if (props.disabled) return
  clearTimers()
  if (!props.modelValue) {
    emit('update:modelValue', true)
    emit('open')
  }
  await nextTick()
  updatePosition()
  await nextTick()
  updatePosition()
}

function close() {
  clearTimers()
  if (!props.modelValue) return
  emit('update:modelValue', false)
  emit('close')
}

function scheduleOpen() {
  if (props.disabled || props.modelValue) return
  clearTimers()
  openTimer = window.setTimeout(() => void open(), Math.max(0, props.openDelay))
}

function scheduleClose() {
  if (triggerFocused.value || panelHovered.value) return
  // Курсор пішов раніше, ніж минула затримка показу, — картка не має
  // з'явитися, коли людина вже проїхала далі. Раніше відкладене відкриття
  // ще й скасовувало відкладене закриття, і картка лишалася висіти назавжди.
  if (openTimer !== null) {
    window.clearTimeout(openTimer)
    openTimer = null
  }
  if (closeTimer !== null) window.clearTimeout(closeTimer)
  closeTimer = window.setTimeout(() => {
    closeTimer = null
    if (!triggerFocused.value && !panelHovered.value) close()
  }, Math.max(0, props.closeDelay))
}

function onTriggerFocus(event: FocusEvent) {
  triggerEl.value = event.currentTarget as HTMLElement
  triggerFocused.value = true
  scheduleOpen()
}

function onTriggerMouseenter(event: MouseEvent) {
  triggerEl.value = event.currentTarget as HTMLElement
  scheduleOpen()
}

function onTriggerBlur() {
  triggerFocused.value = false
  scheduleClose()
}

/**
 * Картка телепортована в кінець <body>: без цього Tab із тригера йшов до
 * наступного елемента сторінки, і посилання в картці («Підписатися»)
 * лишалися недосяжними з клавіатури. Фокус у картку не стрибає сам по
 * собі — лише коли людина тисне Tab, інакше прохід Tab'ом по списку
 * посилань застрягав би в кожній картці.
 */
function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab' || event.shiftKey || !props.modelValue || !panelEl.value) return
  const first = getTabbable(panelEl.value)[0]
  if (!first) return
  event.preventDefault()
  first.focus()
}

function onPanelKeydown(event: KeyboardEvent) {
  const panel = panelEl.value
  if (event.key !== 'Tab' || !panel) return
  const items = getTabbable(panel)
  const active = document.activeElement
  const trigger = triggerEl.value

  if (event.shiftKey) {
    if (items.length && active !== items[0]) return
    event.preventDefault()
    trigger?.focus()
    return
  }

  if (items.length && active !== items[items.length - 1]) return
  // Далі — те, що йде за тригером на сторінці, а не кінець документа.
  event.preventDefault()
  close()
  if (trigger && !focusNextAfter(trigger, [panel])) trigger.focus()
}

function onPanelEnter() {
  panelHovered.value = true
  clearTimers()
}

function onPanelLeave() {
  panelHovered.value = false
  scheduleClose()
}

function onRootMouseenter(event: MouseEvent) {
  triggerEl.value = rootEl.value?.querySelector<HTMLElement>('a, button, [tabindex]')
    ?? (event.target instanceof HTMLElement ? event.target : rootEl.value)
  scheduleOpen()
}

watch(() => props.modelValue, async (visible) => {
  if (!visible) {
    layer.deactivate()
    return
  }
  layer.activate()
  await nextTick()
  updatePosition()
})

onMounted(() => {
  teleportReady.value = true
  window.addEventListener('resize', onViewportChange, { passive: true })
  window.addEventListener('scroll', onViewportChange, { passive: true, capture: true })
  if (props.modelValue) layer.activate()
})

onBeforeUnmount(() => {
  clearTimers()
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

defineExpose({ open, close })
</script>

<template>
  <span ref="rootEl" class="contents" @mouseenter="onRootMouseenter">
    <slot name="trigger" :open="modelValue" :trigger-attrs="triggerAttrs" />
  </span>

  <Teleport to="body" :disabled="!teleportReady">
    <Transition
      enter-active-class="transition duration-(--duration-base) ease-out"
      enter-from-class="translate-y-1 scale-[0.98] opacity-0"
      leave-active-class="transition duration-(--duration-fast) ease-in"
      leave-to-class="translate-y-1 scale-[0.98] opacity-0"
    >
      <div
        v-if="modelValue"
        :id="panelId"
        ref="panelEl"
        role="dialog"
        :aria-label="ariaLabel"
        class="fixed rounded-overlay border border-line bg-dropdown p-4 text-ink shadow-overlay"
        :class="placement.startsWith('top') ? 'origin-bottom' : 'origin-top'"
        :style="{ ...position, width }"
        @mouseenter="onPanelEnter"
        @mouseleave="onPanelLeave"
        @focusin="onPanelEnter"
        @focusout="onPanelLeave"
        @keydown="onPanelKeydown"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>
