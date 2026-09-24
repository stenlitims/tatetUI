<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useId, watch } from 'vue'
import { focusNextAfter, getTabbable } from '~/composables/useFocusTrap'
import { useFloatingLayer } from '~/composables/useOverlayStack'
import { computeAnchoredPanelPosition, getOverlayChildZIndex } from '~/utils/overlayPosition'

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /**
     * Бажана позиція панелі. Якщо не вміщається — перевертається на
     * протилежний бік і притискається до краю вікна.
     */
    placement?: 'bottom-start' | 'bottom' | 'bottom-end' | 'top-start' | 'top' | 'top-end' | 'left' | 'right'
    /** Ширина панелі, будь-яка CSS-величина. Без неї — за вмістом. */
    width?: string
    disabled?: boolean
    /** Клік поза панеллю закриває її. */
    closeOnOutside?: boolean
    /**
     * Escape закриває панель. Escape отримує лише ВЕРХНІЙ шар: відкритий
     * селект чи підказка всередині панелі закриваються першими.
     */
    closeOnEscape?: boolean
    /** Селектор елемента, який отримує фокус після відкриття. */
    initialFocus?: string
    /**
     * Роль панелі. `dialog` — коли всередині є керування; `group` — для
     * згрупованого вмісту без власної семантики вікна.
     */
    panelRole?: 'dialog' | 'group' | 'none'
    /**
     * Доступна назва панелі. Потрібна, коли всередині немає власного
     * заголовка.
     */
    ariaLabel?: string
  }>(),
  {
    modelValue: false,
    placement: 'bottom-start',
    closeOnOutside: true,
    closeOnEscape: true,
    panelRole: 'dialog',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: []
  close: []
}>()

defineSlots<{
  /**
   * Тригер. `triggerAttrs` — на реальну кнопку через `v-bind`: у них ARIA,
   * клік і клавіші (ArrowDown і Tab ведуть у відкриту панель).
   */
  trigger: (props: {
    open: boolean
    toggle: (event?: Event) => void
    triggerAttrs: Record<string, unknown>
  }) => unknown
  /** Вміст панелі. `close` закриває її й повертає фокус на тригер. */
  default?: (props: { close: () => void }) => unknown
}>()

const generatedId = useId()
const panelId = `${generatedId}-popover`

// Панель росте від краю тригера, а не від власного центру.
const originClass = computed(() => {
  const p = props.placement
  if (p.startsWith('top')) return p.endsWith('end') ? 'origin-bottom-right' : 'origin-bottom-left'
  if (p.startsWith('left')) return 'origin-right'
  if (p.startsWith('right')) return 'origin-left'
  return p.endsWith('end') ? 'origin-top-right' : 'origin-top-left'
})
const rootEl = shallowRef<HTMLElement | null>(null)
const triggerEl = shallowRef<HTMLElement | null>(null)
const panelEl = shallowRef<HTMLElement | null>(null)
const teleportReady = shallowRef(false)
const panelStyle = shallowRef<Record<string, string>>({})

/*
 * Escape і клік «повз» — через спільний стек шарів. Раніше поповер слухав
 * Escape на document у фазі захоплення: він випереджав селект усередині
 * себе (Escape закривав увесь поповер замість списку), а натискання на
 * пункт телепортованої випадайки вважав кліком «повз» — вибір губився.
 */
const layer = useFloatingLayer({
  elements: () => [rootEl.value, panelEl.value],
  onEscape: () => {
    if (props.closeOnEscape) close(focusIsOurs())
  },
  onPointerDownOutside: () => {
    if (props.closeOnOutside) close(false)
  },
})

const triggerAttrs = computed(() => ({
  'aria-haspopup': props.panelRole === 'none' ? undefined : 'dialog',
  'aria-expanded': props.modelValue,
  'aria-controls': props.modelValue ? panelId : undefined,
  'aria-disabled': props.disabled ? 'true' : undefined,
  onClick: toggle,
  onKeydown: onTriggerKeydown,
}))

function focusableTrigger() {
  return triggerEl.value?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
}

/**
 * Фокус на тригері, у панелі чи загублений у <body>. Лише тоді закриття
 * повертає його на тригер — інакше Escape для поповера крав би фокус із
 * поля, де людина вже друкує деінде.
 */
function focusIsOurs() {
  const active = document.activeElement
  return (
    !active ||
    active === document.body ||
    !!rootEl.value?.contains(active) ||
    !!panelEl.value?.contains(active)
  )
}

function updatePosition() {
  const anchor = focusableTrigger() ?? triggerEl.value
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const panel = { width: panelEl.value?.offsetWidth ?? 240, height: panelEl.value?.offsetHeight ?? 160 }
  const position = computeAnchoredPanelPosition(
    rect,
    panel,
    { width: window.innerWidth, height: window.innerHeight },
    props.placement,
  )
  panelStyle.value = {
    position: 'fixed',
    top: `${Math.round(position.top)}px`,
    left: `${Math.round(position.left)}px`,
    width: props.width || 'auto',
    zIndex: String(getOverlayChildZIndex(anchor)),
  }
}

/** Перший елемент панелі, а якщо їх немає — сама панель (вона має tabindex="-1"). */
function focusIntoPanel() {
  const panel = panelEl.value
  if (panel) (getTabbable(panel)[0] ?? panel).focus()
}

async function afterOpen(focusInside = false) {
  await nextTick()
  updatePosition()
  await nextTick()
  updatePosition()
  const panel = panelEl.value
  if (!props.modelValue || !panel) return
  if (props.initialFocus) panel.querySelector<HTMLElement>(props.initialFocus)?.focus()
  else if (focusInside) focusIntoPanel()
}

function open(focusInside = false) {
  if (props.disabled || props.modelValue) return
  emit('update:modelValue', true)
  emit('open')
  void afterOpen(focusInside)
}

function close(restoreFocus = false) {
  if (!props.modelValue) return
  emit('update:modelValue', false)
  emit('close')
  if (restoreFocus) void nextTick(() => focusableTrigger()?.focus())
}

/**
 * Enter і Space на кнопці дають click із `detail === 0` — це відкриття з
 * клавіатури, і фокус переходить у панель. Мишею фокус лишається на
 * тригері: панель і так перед очима.
 */
function toggle(event?: Event) {
  if (props.modelValue) close()
  else open(event instanceof MouseEvent && event.detail === 0)
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (props.modelValue) focusIntoPanel()
    else open(true)
    return
  }
  if (event.key !== 'Tab' || !props.modelValue) return
  // Фокус іде назад, геть від поповера — панель не лишається висіти за ним.
  if (event.shiftKey) return close(false)
  // Панель телепортована в кінець <body>: без цього Tab із тригера
  // перестрибував відкритий вміст і йшов до наступного елемента сторінки.
  event.preventDefault()
  focusIntoPanel()
}

function onPanelKeydown(event: KeyboardEvent) {
  const panel = panelEl.value
  if (event.key !== 'Tab' || !panel) return
  const items = getTabbable(panel)
  const active = document.activeElement

  if (event.shiftKey) {
    if (items.length && active !== items[0] && active !== panel) return
    event.preventDefault()
    focusableTrigger()?.focus()
    return
  }

  if (items.length && active !== items[items.length - 1]) return
  // З останнього елемента — далі сторінкою, від тригера. Нативний Tab
  // вивів би фокус із кінця <body> за межі документа.
  event.preventDefault()
  const trigger = focusableTrigger() ?? triggerEl.value
  close(false)
  if (trigger && !focusNextAfter(trigger, [panel])) trigger.focus()
}

function onViewportChange() {
  if (props.modelValue) updatePosition()
}

watch(() => props.modelValue, (openValue) => {
  if (openValue) {
    layer.activate()
    void afterOpen()
  } else {
    layer.deactivate()
  }
})

onMounted(() => {
  teleportReady.value = true
  window.addEventListener('resize', onViewportChange, { passive: true })
  window.addEventListener('scroll', onViewportChange, { passive: true, capture: true })
  // Відкритий із першого рендеру: watch не спрацьовує на початкове значення.
  if (props.modelValue) {
    layer.activate()
    void afterOpen()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

defineExpose({ open, close, toggle })
</script>

<template>
  <div ref="rootEl" class="relative inline-block">
    <div ref="triggerEl">
      <slot name="trigger" :open="modelValue" :toggle="toggle" :trigger-attrs="triggerAttrs" />
    </div>

    <Teleport to="body" :disabled="!teleportReady">
      <Transition
        enter-active-class="transition duration-(--duration-base) ease-out"
        enter-from-class="scale-95 opacity-0"
        leave-active-class="transition duration-(--duration-fast) ease-in"
        leave-to-class="scale-95 opacity-0"
      >
        <!-- Кільце фокуса — для відкриття з клавіатури панелі без жодного
             фокусованого елемента: тоді фокус стоїть на ній самій. -->
        <div
          v-if="modelValue"
          :id="panelId"
          ref="panelEl"
          :role="panelRole === 'none' ? undefined : panelRole"
          :aria-label="ariaLabel"
          tabindex="-1"
          class="fixed rounded-control border border-line bg-dropdown p-3 text-ink shadow-overlay outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="originClass"
          :style="panelStyle"
          @keydown="onPanelKeydown"
        >
          <slot :close="() => close(true)" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
