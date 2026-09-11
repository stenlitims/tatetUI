<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { useToast, type ToastType } from '~/composables/useToast'

/** Глобальний контейнер. Монтується один раз; керування — через useToast(). */
defineSlots<Record<string, never>>()

const { toasts, dismiss, dismissAll, pause, resume } = useToast()
const teleportReady = shallowRef(false)
const region = shallowRef<HTMLElement | null>(null)
const viewport = shallowRef<HTMLElement | null>(null)
const TONES: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
}

// Причини незалежні: вихід курсора не відновлює таймер, якщо всередині
// лишився фокус. Нові повідомлення теж стають на паузу в watcher нижче.
type Interaction = 'hover' | 'focus' | 'pointer' | 'touch'
const interactions = new Set<Interaction>()
const pointers = new Set<number>()
const touches = new Set<number>()
let returnFocus: HTMLElement | null = null

function setInteraction(reason: Interaction, active: boolean) {
  const wasPaused = interactions.size > 0
  if (active) interactions.add(reason)
  else interactions.delete(reason)
  const isPaused = interactions.size > 0
  if (wasPaused === isPaused) return
  for (const toast of toasts.value) (isPaused ? pause : resume)(toast.id)
}

function onPointerEnter(event: PointerEvent) {
  // Touch може синтезувати mouseenter без наступного mouseleave.
  if (event.pointerType === 'mouse') setInteraction('hover', true)
}

function onPointerLeave(event: PointerEvent) {
  if (event.pointerType === 'mouse') setInteraction('hover', false)
}

function onFocusIn(event: FocusEvent) {
  const previous = event.relatedTarget
  if (previous instanceof HTMLElement && !region.value?.contains(previous)) returnFocus = previous
  setInteraction('focus', true)
}

function onFocusOut(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && region.value?.contains(event.relatedTarget)) return
  setInteraction('focus', false)
}

function onInteractionStart(event: PointerEvent) {
  if (event.button !== 0) return
  pointers.add(event.pointerId)
  setInteraction('pointer', true)
}

// При нативному вертикальному скролі браузер надсилає pointercancel ще
// ДО підняття пальця. Touch-події тримають паузу до справжнього touchend.
function onTouchStart(event: TouchEvent) {
  for (const touch of Array.from(event.changedTouches)) touches.add(touch.identifier)
  setInteraction('touch', touches.size > 0)
}

function onTouchEnd(event: TouchEvent) {
  for (const touch of Array.from(event.changedTouches)) touches.delete(touch.identifier)
  setInteraction('touch', touches.size > 0)
}

const SWIPE_THRESHOLD = 48
const AXIS_THRESHOLD = 8
interface Drag {
  id: number
  pointerId: number
  element: HTMLElement
  startX: number
  startY: number
  axis: 'x' | 'y' | null
  x: number
}
const drag = shallowRef<Drag | null>(null)
const exits = new Map<number, number>()
const leaving = new Set<Element>()

function onPointerDown(id: number, event: PointerEvent) {
  if (event.button !== 0 || drag.value || event.isPrimary === false) return
  if (
    (event.target as Element).closest(
      'button, a, input, select, textarea, [contenteditable], [role="button"]',
    )
  )
    return
  drag.value = {
    id,
    pointerId: event.pointerId,
    element: event.currentTarget as HTMLElement,
    startX: event.clientX,
    startY: event.clientY,
    axis: null,
    x: 0,
  }
}

function onPointerMove(event: PointerEvent) {
  const current = drag.value
  if (!current || current.pointerId !== event.pointerId) return
  const dx = event.clientX - current.startX
  const dy = event.clientY - current.startY
  let axis = current.axis
  if (!axis) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_THRESHOLD) return
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (axis === 'x') {
      try {
        current.element.setPointerCapture(event.pointerId)
      } catch {
        // Вказівник уже міг завершитися; глобальні up/cancel усе приберуть.
      }
    }
  }
  drag.value = { ...current, axis, x: axis === 'x' ? dx : 0 }
}

function resetDrag() {
  const current = drag.value
  drag.value = null
  if (current?.element.hasPointerCapture?.(current.pointerId)) {
    current.element.releasePointerCapture(current.pointerId)
  }
}

function onPointerEnd(event: PointerEvent) {
  const current = drag.value
  if (current?.pointerId === event.pointerId) {
    const dx = event.clientX - current.startX
    if (event.type === 'pointerup' && current.axis === 'x' && Math.abs(dx) >= SWIPE_THRESHOLD) {
      exits.set(current.id, dx)
      dismiss(current.id)
    }
    resetDrag()
  }
  pointers.delete(event.pointerId)
  setInteraction('pointer', pointers.size > 0)
}

function onLostPointerCapture(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId) onPointerEnd(event)
}

function dragStyle(id: number) {
  if (drag.value?.id !== id || drag.value.axis !== 'x') return undefined
  return {
    '--toast-drag-x': `${drag.value.x}px`,
    '--toast-drag-opacity': Math.max(0.25, 1 - Math.abs(drag.value.x) / 320),
  }
}

function beforeLeave(element: Element) {
  const item = element as HTMLElement
  const list = item.parentElement
  // Скрол-контейнер не має схлопнутися й обрізати вихід останньої картки.
  // Висоту тримає список, тож viewport усе ще поважає мобільний max-height.
  if (list && !leaving.size) list.style.minHeight = `${list.offsetHeight}px`
  leaving.add(element)
  // Зафіксувати місце до position:absolute, щоб решта списку могла
  // одразу пересунутися. Свайп живе на внутрішній картці, FLIP — зовні.
  item.style.top = `${item.offsetTop}px`
  item.style.width = `${item.offsetWidth}px`
  const dx = exits.get(Number(item.dataset.toastId))
  item.querySelector('.ui-toast-card')?.classList.remove('is-dragging')
  if (dx !== undefined) {
    item.classList.add('ui-toast-swiped')
    item.style.setProperty('--toast-swipe-from', `${dx}px`)
    item.style.setProperty(
      '--toast-swipe-to',
      `${Math.sign(dx) * (item.offsetWidth + Math.abs(dx))}px`,
    )
  }
  // Вилучені, але ще анімовані кнопки не потрапляють у Tab-обхід.
  item.inert = true
  item.setAttribute('aria-hidden', 'true')
}

function afterLeave(element: Element) {
  exits.delete(Number((element as HTMLElement).dataset.toastId))
  leaving.delete(element)
  const list = viewport.value?.firstElementChild as HTMLElement | null
  if (!leaving.size && list) list.style.minHeight = ''
}

watch(
  () => toasts.value.map((toast) => toast.id),
  async (ids, previousIds) => {
    if (interactions.size) for (const id of ids) pause(id)
    if (drag.value && !ids.includes(drag.value.id)) resetDrag()

    const list = viewport.value
    const nearEnd = !list || list.scrollHeight - list.scrollTop - list.clientHeight <= 32
    const appended = ids.some((id) => !previousIds.includes(id))
    const focused =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
    const focusedToast = focused?.closest<HTMLElement>('[data-toast-id]')
    const removingFocus =
      !!focused &&
      !!region.value?.contains(focused) &&
      ((focusedToast && !ids.includes(Number(focusedToast.dataset.toastId))) ||
        (focused.closest('.ui-toaster-toolbar') && ids.length < 3))

    await nextTick()
    if (appended && nearEnd && viewport.value)
      viewport.value.scrollTop = viewport.value.scrollHeight

    if (
      removingFocus &&
      (document.activeElement === focused || document.activeElement === document.body)
    ) {
      const previousIndex = focusedToast
        ? previousIds.indexOf(Number(focusedToast.dataset.toastId))
        : 0
      const nextId = ids[Math.min(Math.max(previousIndex, 0), ids.length - 1)]
      const next = region.value?.querySelector<HTMLElement>(
        `[data-toast-id="${nextId}"]:not([inert]) button`,
      )
      const target = next ?? returnFocus
      if (target?.isConnected && !target.closest('[inert]')) {
        target.focus({ preventScroll: true })
        // Після закриття фокус лишається біля прочитаного повідомлення;
        // сусідню кнопку показуємо в прокручуваній області, якщо потрібно.
        next?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
      setInteraction('focus', !!region.value?.contains(document.activeElement))
    }
    if (!ids.length) {
      interactions.clear()
      pointers.clear()
      touches.clear()
    }
  },
)

onMounted(() => {
  teleportReady.value = true
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerEnd)
  window.addEventListener('pointercancel', onPointerEnd)
  window.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('touchcancel', onTouchEnd, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerEnd)
  window.removeEventListener('pointercancel', onPointerEnd)
  window.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('touchcancel', onTouchEnd)
  resetDrag()
  if (interactions.size) for (const toast of toasts.value) resume(toast.id)
  interactions.clear()
  exits.clear()
  leaving.clear()
})
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <!-- Цей маркер зберігає доступність сповіщень під відкритою модалкою. -->
    <div
      ref="region"
      data-overlay-ignore
      class="ui-toaster"
      role="region"
      aria-label="Сповіщення"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      @pointerdown.capture="onInteractionStart"
      @touchstart.passive="onTouchStart"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <div
        v-if="toasts.length >= 3"
        class="ui-toaster-toolbar rounded-overlay border border-line bg-card shadow-raised"
      >
        <span class="ui-toaster-count text-muted"
          >Сповіщення <span aria-hidden="true">·</span>
          <strong class="font-semibold text-ink">{{ toasts.length }}</strong></span
        >
        <button
          type="button"
          class="ui-toaster-clear rounded-control text-muted hover:bg-hover hover:text-ink"
          @click="dismissAll"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
          </svg>
          Очистити всі
        </button>
      </div>

      <div ref="viewport" class="ui-toaster-viewport">
        <TransitionGroup
          name="ui-toast"
          tag="div"
          class="ui-toaster-list"
          @before-leave="beforeLeave"
          @after-leave="afterLeave"
        >
          <div
            v-for="toast in toasts"
            :key="toast.id"
            :data-toast-id="toast.id"
            class="ui-toast-item"
          >
            <div
              class="ui-toast-card rounded-overlay border border-line bg-card shadow-raised"
              :class="[
                TONES[toast.type],
                { 'is-dragging': drag?.id === toast.id && drag.axis === 'x' },
              ]"
              :style="dragStyle(toast.id)"
              :role="toast.type === 'error' ? 'alert' : 'status'"
              :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
              aria-atomic="true"
              @pointerdown="onPointerDown(toast.id, $event)"
              @lostpointercapture="onLostPointerCapture"
            >
              <div class="ui-toast-icon" aria-hidden="true">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <template v-if="toast.type === 'success'">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8 12 2.5 2.5L16 9" />
                  </template>
                  <template v-else-if="toast.type === 'warning'">
                    <path
                      d="M10.3 4.4 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z"
                    />
                    <path d="M12 9v4m0 4h.01" />
                  </template>
                  <template v-else-if="toast.type === 'error'">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 9 6 6m0-6-6 6" />
                  </template>
                  <template v-else>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5m0-8h.01" />
                  </template>
                </svg>
              </div>
              <div class="ui-toast-content">
                <p v-if="toast.title" class="ui-toast-title font-semibold text-ink">
                  {{ toast.title }}
                </p>
                <p class="ui-toast-message" :class="toast.title ? 'text-muted' : 'text-ink'">
                  {{ toast.message }}
                </p>
              </div>
              <button
                type="button"
                class="ui-toast-close rounded-control text-muted hover:bg-hover hover:text-ink"
                aria-label="Закрити сповіщення"
                @click="dismiss(toast.id)"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="m18 6-12 12M6 6l12 12" />
                </svg>
              </button>
              <!-- Дії — дані, і не закривають тост автоматично. -->
              <div v-if="toast.actions?.length" class="ui-toast-actions">
                <button
                  v-for="(action, index) in toast.actions"
                  :key="index"
                  type="button"
                  class="ui-toast-action rounded-control border border-line bg-card font-medium text-ink hover:border-line-strong hover:bg-hover"
                  @click="action.onClick()"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ui-toaster {
  --toast-enter-y: 12px;
  position: fixed;
  z-index: 9999;
  right: max(8px, env(safe-area-inset-right, 0px));
  bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  left: max(8px, env(safe-area-inset-left, 0px));
  display: flex;
  flex-direction: column;
  max-height: 50vh;
  max-height: 50dvh;
  pointer-events: none;
}

.ui-toaster-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  margin: 4px 4px 8px;
  padding: 4px 4px 4px 12px;
  pointer-events: auto;
}

.ui-toaster-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ui-toaster-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 500;
}
.ui-toaster-viewport {
  min-height: 0;
  overflow: auto;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  pointer-events: auto;
}
.ui-toaster-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
}
.ui-toaster-list:empty {
  padding: 0;
}
.ui-toast-item {
  flex: none;
  min-width: 0;
}

.ui-toast-card {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 32px;
  align-items: start;
  gap: 0 12px;
  padding: 16px;
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  transform: translateX(var(--toast-drag-x, 0px));
  opacity: var(--toast-drag-opacity, 1);
  transition:
    transform var(--duration-slow) var(--ease-emphasized),
    opacity var(--duration-base) var(--ease-out);
}

.ui-toast-card::before {
  content: '';
  position: absolute;
  inset: 16px auto 16px 0;
  width: 3px;
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
  background: currentColor;
  opacity: 0.75;
}
.ui-toast-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
  border-radius: var(--radius-control);
  background: color-mix(in srgb, currentColor 9%, var(--bg-card));
}
.ui-toast-content {
  min-width: 0;
  align-self: center;
}
.ui-toast-title {
  margin: 0 0 3px;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.ui-toast-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.ui-toast-close {
  display: grid;
  width: 32px;
  height: 32px;
  margin: -5px -5px 0 0;
  justify-self: end;
  place-items: center;
}
.ui-toast-actions {
  grid-column: 2 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  margin-top: 12px;
}
.ui-toast-action {
  max-width: 100%;
  min-height: 32px;
  padding: 6px 12px;
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: start;
}
.ui-toast-close,
.ui-toast-action,
.ui-toaster-clear {
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}
.ui-toast-close:focus-visible,
.ui-toast-action:focus-visible,
.ui-toaster-clear:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.is-dragging {
  user-select: none;
  transition: none;
  cursor: grabbing;
}

.ui-toast-enter-active,
.ui-toast-move {
  transition:
    transform var(--duration-slow) var(--ease-emphasized),
    opacity var(--duration-slow) var(--ease-out);
}
.ui-toast-enter-from {
  opacity: 0;
  transform: translateY(var(--toast-enter-y)) scale(0.97);
}
.ui-toast-leave-active {
  position: absolute;
  pointer-events: none;
  transition:
    transform var(--duration-base) var(--ease-in),
    opacity var(--duration-base) var(--ease-in);
}
.ui-toast-leave-to {
  opacity: 0;
  transform: translateY(var(--toast-enter-y)) scale(0.98);
}
.ui-toast-swiped .ui-toast-card {
  transform: translateX(var(--toast-swipe-from));
  transition:
    transform var(--duration-base) var(--ease-in),
    opacity var(--duration-base) var(--ease-in);
}
.ui-toast-swiped.ui-toast-leave-to {
  transform: none;
}
.ui-toast-swiped.ui-toast-leave-to .ui-toast-card {
  transform: translateX(var(--toast-swipe-to));
  opacity: 0;
}

@media (min-width: 768px) {
  .ui-toaster {
    --toast-enter-y: -12px;
    top: 12px;
    right: 12px;
    bottom: auto;
    left: auto;
    width: 408px;
    max-height: 70vh;
    max-height: 70dvh;
  }
}

@media (max-width: 767px), (pointer: coarse) {
  .ui-toast-card {
    grid-template-columns: 34px minmax(0, 1fr) 36px;
    gap: 0 8px;
    padding: 14px;
  }
  .ui-toast-close {
    width: 44px;
    height: 44px;
    margin: -8px -8px 0 0;
  }
  .ui-toast-action,
  .ui-toaster-clear {
    min-width: 44px;
    min-height: 44px;
  }
  .ui-toast-actions {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-toast-item,
  .ui-toast-card,
  .ui-toast-swiped .ui-toast-card,
  .ui-toast-close,
  .ui-toast-action,
  .ui-toaster-clear {
    transition-duration: 1ms;
  }
  .ui-toast-enter-from,
  .ui-toast-leave-to,
  .ui-toast-swiped.ui-toast-leave-to .ui-toast-card {
    transform: none;
  }
}
</style>
