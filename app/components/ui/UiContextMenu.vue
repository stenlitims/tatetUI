<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { focusNextAfter } from '~/composables/useFocusTrap'
import { useFloatingLayer } from '~/composables/useOverlayStack'
import { getOverlayChildZIndex } from '~/utils/overlayPosition'

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /** Ширина меню, будь-яка CSS-величина. */
    width?: string
    disabled?: boolean
    /** Доступна назва меню. */
    ariaLabel?: string
  }>(),
  { modelValue: false, width: '14rem', disabled: false, ariaLabel: 'Контекстне меню' },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: []
  close: []
}>()

defineSlots<{
  /**
   * Область, для якої відкривається меню. Передайте `targetAttrs` реальному
   * елементу: у них права кнопка, Shift+F10 і довге натискання пальцем.
   */
  default: (props: {
    open: boolean
    targetAttrs: {
      'aria-haspopup': 'menu'
      'aria-expanded': boolean
      'aria-controls': string | undefined
      'aria-disabled': 'true' | undefined
      style: Record<string, string>
      onContextmenu: (event: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
      onPointerdown: (event: PointerEvent) => void
      onPointermove: (event: PointerEvent) => void
      onPointerup: () => void
      onPointercancel: () => void
    }
  }) => unknown
  /** Пункти з `role="menuitem"`. */
  content: (props: { close: () => void }) => unknown
}>()

const rootEl = ref<HTMLElement | null>(null)
const targetEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const teleportReady = shallowRef(false)
const point = shallowRef({ x: 0, y: 0 })
const position = shallowRef({ top: '0px', left: '0px', zIndex: '1100' })
const menuId = `${useId()}-context-menu`

const targetAttrs = computed(() => ({
  'aria-haspopup': 'menu' as const,
  'aria-expanded': props.modelValue,
  'aria-controls': props.modelValue ? menuId : undefined,
  'aria-disabled': props.disabled ? ('true' as const) : undefined,
  // iOS на довгому натисканні показує власну виноску «Копіювати/Поділитися»
  // поверх нашого меню. Ключ у kebab-case — так його однаково пише і SSR.
  style: { '-webkit-touch-callout': 'none' },
  onContextmenu: onContextMenu,
  onKeydown: onTargetKeydown,
  onPointerdown: onTargetPointerdown,
  onPointermove: onTargetPointermove,
  onPointerup: onTargetPointerup,
  onPointercancel: cancelLongPress,
}))

/*
 * Escape і клік «повз» — через спільний стек шарів, як в інших плаваючих
 * панелей: так Escape дістається верхнього шару, а не того, чий слухач
 * зареєструвався першим.
 */
const layer = useFloatingLayer({
  elements: () => [menuEl.value, targetEl.value],
  onEscape: () => close(),
  onPointerDownOutside: () => close(false),
})

function enabledItems() {
  return menuEl.value
    ? Array.from(menuEl.value.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"]), button:not([disabled]), a[href]:not([aria-disabled="true"])'))
    : []
}

function focusItem(last = false) {
  const items = enabledItems()
  ;(last ? items[items.length - 1] : items[0])?.focus()
}

function updatePosition() {
  if (typeof window === 'undefined') return
  const width = menuEl.value?.offsetWidth || 224
  const height = menuEl.value?.offsetHeight || 160
  const edge = 8
  position.value = {
    top: `${Math.round(Math.max(edge, Math.min(point.value.y, window.innerHeight - height - edge)))}px`,
    left: `${Math.round(Math.max(edge, Math.min(point.value.x, window.innerWidth - width - edge)))}px`,
    zIndex: String(getOverlayChildZIndex(targetEl.value)),
  }
}

async function show(x: number, y: number, source?: HTMLElement | null) {
  if (props.disabled) return
  targetEl.value = source ?? targetEl.value ?? rootEl.value
  point.value = { x, y }
  if (!props.modelValue) {
    emit('update:modelValue', true)
    emit('open')
  }
  await nextTick()
  updatePosition()
  await nextTick()
  updatePosition()
  focusItem()
}

function close(restoreFocus = true) {
  if (!props.modelValue) return
  resetTypeahead()
  emit('update:modelValue', false)
  emit('close')
  if (restoreFocus) nextTick(() => targetEl.value?.focus())
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  // Android сам шле contextmenu на довгому натисканні — власний таймер
  // тоді зайвий, інакше меню відкрилося б двічі.
  cancelLongPress()
  targetEl.value = event.currentTarget as HTMLElement
  void show(event.clientX, event.clientY, targetEl.value)
}

function onTargetKeydown(event: KeyboardEvent) {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  void show(rect.left + 12, rect.top + 12, target)
}

/* ------------------------------------------------------------------ */
/*  Довге натискання пальцем чи пером                                  */
/* ------------------------------------------------------------------ */

/*
 * iOS Safari на довге натискання НЕ шле contextmenu — без цього меню на
 * iPhone та iPad не відкривалося взагалі. Рух далі за LONG_PRESS_SLOP —
 * це прокрутка, а не намір відкрити меню.
 */
const LONG_PRESS_MS = 600
const LONG_PRESS_SLOP = 10

let longPress: { timer: number; x: number; y: number; pointerId: number } | null = null
let longPressFired = false

function cancelLongPress() {
  if (!longPress) return
  window.clearTimeout(longPress.timer)
  longPress = null
}

function onTargetPointerdown(event: PointerEvent) {
  if (event.pointerType === 'mouse' || props.disabled) return
  cancelLongPress()
  longPressFired = false
  const target = event.currentTarget as HTMLElement
  const { clientX: x, clientY: y, pointerId } = event
  longPress = {
    x,
    y,
    pointerId,
    timer: window.setTimeout(() => {
      longPress = null
      longPressFired = true
      void show(x, y, target)
    }, LONG_PRESS_MS),
  }
}

function onTargetPointermove(event: PointerEvent) {
  if (!longPress || event.pointerId !== longPress.pointerId) return
  const moved = Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y)
  if (moved > LONG_PRESS_SLOP) cancelLongPress()
}

/**
 * Палець відпустили після того, як меню вже відкрилося: браузер може
 * догнати це click'ом по тому самому місці — а там уже перший пункт меню
 * або сам рядок. Такий click гасимо, щоб довге натискання не спрацювало ще
 * й як звичайне.
 */
function onTargetPointerup() {
  cancelLongPress()
  if (!longPressFired) return
  longPressFired = false
  const swallow = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    stop()
  }
  const stop = () => {
    document.removeEventListener('click', swallow, true)
    window.clearTimeout(timeout)
  }
  document.addEventListener('click', swallow, true)
  const timeout = window.setTimeout(stop, 400)
}

/* ------------------------------------------------------------------ */
/*  Клавіатура в меню                                                  */
/* ------------------------------------------------------------------ */

/*
 * Друк літери переводить фокус на пункт, що з неї починається (APG).
 * Буфер живе пів секунди; та сама літера поспіль перебирає пункти на неї.
 */
let typeahead = ''
let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

function resetTypeahead() {
  if (typeaheadTimer) clearTimeout(typeaheadTimer)
  typeaheadTimer = undefined
  typeahead = ''
}

function onTypeahead(event: KeyboardEvent, items: HTMLElement[]): boolean {
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return false
  // Пробіл без набраного буфера — це натискання пункту, а не пошук.
  if (event.key === ' ' && !typeahead) return false
  if (typeaheadTimer) clearTimeout(typeaheadTimer)
  typeaheadTimer = setTimeout(resetTypeahead, 500)
  typeahead += event.key.toLowerCase()

  const repeated = [...typeahead].every((char) => char === typeahead[0])
  const query = repeated ? typeahead[0]! : typeahead
  const current = items.indexOf(document.activeElement as HTMLElement)
  const start = current === -1 ? 0 : current + (repeated ? 1 : 0)
  for (let offset = 0; offset < items.length; offset += 1) {
    const item = items[(start + offset) % items.length]!
    if ((item.textContent ?? '').trim().toLowerCase().startsWith(query)) {
      item.focus()
      break
    }
  }
  return true
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    // Меню телепортоване в кінець <body>: нативний Tab вивів би фокус за
    // межі сторінки. Ведемо його від області, для якої меню відкрили.
    event.preventDefault()
    const target = targetEl.value
    close(false)
    if (event.shiftKey || !target || !focusNextAfter(target, [menuEl.value])) target?.focus()
    return
  }
  const items = enabledItems()
  if (!items.length) return
  const current = items.indexOf(document.activeElement as HTMLElement)
  let next = current
  if (event.key === 'ArrowDown') next = (current + 1 + items.length) % items.length
  else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else {
    if (onTypeahead(event, items)) event.preventDefault()
    return
  }
  event.preventDefault()
  items[next]?.focus()
}

watch(() => props.modelValue, async (open) => {
  if (!open) {
    layer.deactivate()
    return
  }
  layer.activate()
  await nextTick()
  updatePosition()
})

onMounted(() => {
  teleportReady.value = true
  window.addEventListener('resize', updatePosition, { passive: true })
})

onBeforeUnmount(() => {
  cancelLongPress()
  resetTypeahead()
  window.removeEventListener('resize', updatePosition)
})

defineExpose({ show, close })
</script>

<template>
  <div ref="rootEl" class="contents">
    <slot :open="modelValue" :target-attrs="targetAttrs" />
  </div>

  <Teleport to="body" :disabled="!teleportReady">
    <Transition
      enter-active-class="transition duration-(--duration-base) ease-out"
      enter-from-class="scale-95 opacity-0"
      leave-active-class="transition duration-(--duration-fast) ease-in"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="modelValue"
        :id="menuId"
        ref="menuEl"
        role="menu"
        :aria-label="ariaLabel"
        data-ui-context-menu
        class="scrollbar-thin origin-top-left fixed max-h-80 overflow-y-auto rounded-control border border-line bg-dropdown p-1 text-ink shadow-overlay outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :style="{ ...position, width }"
        tabindex="-1"
        @keydown="onMenuKeydown"
      >
        <slot name="content" :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>
