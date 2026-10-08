<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { useToast, type Toast, type ToastType } from '~/composables/useToast'

/** Глобальний контейнер. Монтується один раз; керування — через useToast(). */
defineSlots<Record<string, never>>()

withDefaults(
  defineProps<{
    /**
     * Де стоїть стос сповіщень на екрані від 768px: `top-right` (за
     * замовчуванням), `bottom-right` або `bottom-center`. У застосунках із
     * кнопками в шапці знизу не перекриває елементи керування. На вужчому
     * екрані стос завжди знизу на всю ширину.
     */
    placement?: 'top-right' | 'bottom-right' | 'bottom-center'
  }>(),
  { placement: 'top-right' },
)

const { toasts, dismiss, dismissAll, pause, resume } = useToast()
const teleportReady = shallowRef(false)
const region = shallowRef<HTMLElement | null>(null)
const viewport = shallowRef<HTMLElement | null>(null)
const TONES: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  loading: 'text-neutral',
}

/*
 * Невидима зона дотику 45×45 навколо дрібних кнопок — той самий патерн,
 * що в UiButton і UiAlert. Видима кнопка лишається компактною, а палець
 * на телефоні влучає по зоні, а не по 22px хрестику.
 */
const TOUCH_TARGET =
  'pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 ' +
  'pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 ' +
  "pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"

// Причини незалежні: вихід курсора не відновлює таймер, якщо всередині
// лишився фокус. Нові повідомлення теж стають на паузу в watcher нижче.
type Interaction = 'hover' | 'focus' | 'pointer' | 'touch'
const interactions = new Set<Interaction>()
const pointers = new Set<number>()
const touches = new Set<number>()
let returnFocus: HTMLElement | null = null

/*
 * Оголошення — в ОКРЕМИХ live-регіонах, що існують із моменту монтування.
 * Раніше live-регіоном була сама картка (role="status"), вставлена в DOM
 * разом із текстом, а регіон, що з'явився одночасно зі змістом,
 * скрінрідери оголошують ненадійно: NVDA у Chrome мовчав. Зміну в регіоні,
 * який уже був у DOM, читають усі.
 *
 * Кілька останніх записів, а не один: два тости в одному такті інакше
 * перезаписали б один одного, і перший ніхто б не почув.
 */
interface Announcement {
  key: number
  toastId: number
  text: string
}
const politeLog = shallowRef<Announcement[]>([])
const assertiveLog = shallowRef<Announcement[]>([])
const announced = new Map<number, string>()
let announceKey = 0

function announce(toast: Toast) {
  const text = [toast.title, toast.message].filter(Boolean).join('. ')
  const signature = `${toast.type}|${text}`
  if (announced.get(toast.id) === signature) return
  announced.set(toast.id, signature)
  const log = toast.type === 'error' ? assertiveLog : politeLog
  log.value = [...log.value.slice(-4), { key: ++announceKey, toastId: toast.id, text }]
}

// Закритий тост не має лишатися текстом у регіоні: у режимі читання
// скрінрідер знайшов би там повідомлення, якого на екрані вже немає.
function pruneAnnouncements(ids: Set<number>) {
  for (const id of announced.keys()) if (!ids.has(id)) announced.delete(id)
  const keep = (entry: Announcement) => ids.has(entry.toastId)
  if (!politeLog.value.every(keep)) politeLog.value = politeLog.value.filter(keep)
  if (!assertiveLog.value.every(keep)) assertiveLog.value = assertiveLog.value.filter(keep)
}

/*
 * F8 — як у Radix: область сповіщень стоїть у кінці <body>, і без гарячої
 * клавіші кнопка «Скасувати» в тості була досяжна лише мишею. Під
 * відкритою модалкою це безпечно: область має data-overlay-ignore, пастка
 * фокуса її не чіпає, а F8 чи Escape повертають фокус туди, звідки прийшли.
 */
function isInRegion(node: Element | null) {
  return !!node && !!region.value?.contains(node)
}

function leaveRegion() {
  const target = returnFocus
  if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true })
  else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'F8' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (!region.value || !toasts.value.length) return
  event.preventDefault()
  if (isInRegion(document.activeElement)) {
    leaveRegion()
    return
  }
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  // tabindex — лише на час переходу з F8. Постійний зробив би фокусованою
  // всю область: клік по тексту тосту фокусував би її, і черга стояла б на
  // паузі, доки людина не клацне деінде.
  region.value.tabIndex = -1
  region.value.focus({ preventScroll: true })
}

function onRegionKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Escape тут — «вийти зі сповіщень», а не «закрити модалку під ними»:
  // зупиняємо, поки подія не дійшла до спільного слухача оверлеїв.
  event.preventDefault()
  event.stopPropagation()
  leaveRegion()
}

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
  if (previous instanceof HTMLElement && !isInRegion(previous)) returnFocus = previous
  setInteraction('focus', true)
}

function onFocusOut(event: FocusEvent) {
  if (event.target === region.value) region.value?.removeAttribute('tabindex')
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

/*
 * Новий або змінений тост (toast.update, toast.promise) — оголосити. Оновлений
 * тост отримує новий таймер; під курсором чи фокусом він має стати на паузу,
 * як і решта черги.
 */
watch(
  () => toasts.value.map((toast) => `${toast.id}|${toast.type}|${toast.title ?? ''}|${toast.message}`),
  () => {
    pruneAnnouncements(new Set(toasts.value.map((toast) => toast.id)))
    for (const toast of toasts.value) {
      announce(toast)
      if (interactions.size) pause(toast.id)
    }
  },
)

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('keydown', onDocumentKeydown)
  // Тости, показані ще до монтування, — оголосити вже в змонтований регіон.
  void nextTick(() => {
    for (const toast of toasts.value) announce(toast)
  })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerEnd)
  window.addEventListener('pointercancel', onPointerEnd)
  window.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('touchcancel', onTouchEnd, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
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
  announced.clear()
})
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <!-- Цей маркер зберігає доступність сповіщень під відкритою модалкою. -->
    <div
      ref="region"
      data-overlay-ignore
      class="ui-toaster"
      :data-placement="placement"
      role="region"
      aria-label="Сповіщення"
      aria-keyshortcuts="F8"
      @keydown="onRegionKeydown"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      @pointerdown.capture="onInteractionStart"
      @touchstart.passive="onTouchStart"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <!-- Live-регіони існують до першого тосту — див. коментар до announce(). -->
      <div class="sr-only" aria-live="polite" aria-atomic="false" aria-relevant="additions">
        <p v-for="entry in politeLog" :key="entry.key">{{ entry.text }}</p>
      </div>
      <div class="sr-only" aria-live="assertive" aria-atomic="false" aria-relevant="additions">
        <p v-for="entry in assertiveLog" :key="entry.key">{{ entry.text }}</p>
      </div>

      <div
        v-if="toasts.length >= 3"
        class="ui-toaster-toolbar flex items-center justify-between gap-2 rounded-card border border-line bg-card py-1 pr-1 pl-3 shadow-raised"
      >
        <!-- &nbsp; перед числом: Vue викидає пробіл між елементами, якщо в
             ньому є перенос рядка, і виходило «·4». -->
        <span class="ui-toaster-count text-xs text-muted">
          Сповіщення <span aria-hidden="true">·</span>&nbsp;<strong
            class="font-semibold text-ink"
            >{{ toasts.length }}</strong
          >
        </span>
        <button
          type="button"
          class="ui-toaster-clear relative flex h-7 items-center gap-1.5 rounded-control px-2 text-xs font-medium text-muted hover:bg-hover hover:text-ink"
          :class="TOUCH_TARGET"
          @click="dismissAll"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
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
          role="list"
          class="ui-toaster-list"
          @before-leave="beforeLeave"
          @after-leave="afterLeave"
        >
          <div
            v-for="toast in toasts"
            :key="toast.id"
            :data-toast-id="toast.id"
            role="listitem"
            class="ui-toast-item"
          >
            <!--
              Анатомія й метрики — як у UiAlert: іконка h-4.5 без підкладки,
              text-sm, p-3, rounded-card. Тон несе лише іконка: кольорова
              смуга збоку і плитка під іконкою робили кожну картку
              найгучнішим елементом екрана, а стос із чотирьох — тим паче.
              Поверхня нейтральна, як в інших оверлеїв: тост висить над
              довільним вмістом, і відділяє його тінь, а не заливка тону.
            -->
            <div
              class="ui-toast-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-card border border-line bg-card p-3 text-sm shadow-raised"
              :class="{ 'is-dragging': drag?.id === toast.id && drag.axis === 'x' }"
              :style="dragStyle(toast.id)"
              :aria-busy="toast.type === 'loading' || undefined"
              @pointerdown="onPointerDown(toast.id, $event)"
              @lostpointercapture="onLostPointerCapture"
            >
              <svg
                class="mt-0.5 h-4.5 w-4.5"
                :class="TONES[toast.type]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <template v-if="toast.type === 'success'">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8.5 12.5 2.5 2.5 5-5" />
                </template>
                <template v-else-if="toast.type === 'warning'">
                  <path d="M12 3 2.5 20h19L12 3z" />
                  <path d="M12 9v5" />
                  <path d="M12 17h.01" />
                </template>
                <template v-else-if="toast.type === 'error'">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M15 9l-6 6" />
                  <path d="M9 9l6 6" />
                </template>
                <!-- Обертання гасить глобальний reduced-motion; нерухома дуга
                     все одно читається як «триває». -->
                <g v-else-if="toast.type === 'loading'" class="ui-toast-spinner">
                  <circle cx="12" cy="12" r="9" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" />
                </g>
                <template v-else>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5" />
                  <path d="M12 8h.01" />
                </template>
              </svg>
              <div class="min-w-0 wrap-anywhere">
                <p v-if="toast.title" class="font-semibold text-ink">{{ toast.title }}</p>
                <p
                  class="whitespace-pre-line"
                  :class="toast.title ? 'mt-0.5 text-muted' : 'text-ink'"
                >
                  {{ toast.message }}
                </p>
              </div>
              <!--
                Хрестик ~22px, як в UiAlert, а на дотику — невидима зона 45×45.
                У DOM він стоїть ПЕРЕД діями: після закриття фокус переходить
                на першу кнопку сусіднього тосту, і це має бути «Закрити», а не
                чиясь дія, яку Enter запустив би випадково. -my-0.5 ставить
                центр хрестика на центр першого рядка й не роздуває картку.
              -->
              <button
                type="button"
                class="ui-toast-close relative -my-0.5 -mr-1 rounded-control p-1 text-muted hover:bg-hover hover:text-ink"
                :class="TOUCH_TARGET"
                aria-label="Закрити сповіщення"
                @click="dismiss(toast.id)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <!--
                Дії — дані, і не закривають тост автоматично. Висота — як у
                UiButton sm (h-9 → md:h-8), а не окремі 44px-кнопки на
                телефоні: точність дотику тримає невидима зона, як скрізь у
                бібліотеці. Шрифт на телефоні — text-sm, як у повідомлення, а
                не text-base кнопки sm: поруч немає поля, з яким його рівняти,
                а підпис, більший за текст тосту, перетягував увагу на себе.
                min-h замість h: довгий підпис переноситься, а не вилазить за
                картку.
              -->
              <div
                v-if="toast.actions?.length"
                class="col-start-2 col-end-4 mt-2.5 flex flex-wrap gap-2 wrap-anywhere"
              >
                <button
                  v-for="(action, index) in toast.actions"
                  :key="index"
                  type="button"
                  class="ui-toast-action relative min-h-9 max-w-full rounded-control border border-line bg-card px-3 py-1 text-start text-sm font-medium text-ink hover:border-line-strong hover:bg-hover md:min-h-8 md:px-2.5 md:text-xs"
                  :class="TOUCH_TARGET"
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
  bottom: calc(8px + var(--toaster-offset-bottom, 0px) + env(safe-area-inset-bottom, 0px));
  left: max(8px, env(safe-area-inset-left, 0px));
  display: flex;
  flex-direction: column;
  max-height: 50vh;
  max-height: 50dvh;
  pointer-events: none;
}

.ui-toaster:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Поля панелі = поля списку: від панелі до першої картки той самий
   крок, що між картками, і краї збігаються з краями карток.
   z-index: невидима зона «Очистити всі» звисає нижче панелі, а список
   позиціонований і стоїть пізніше в DOM — без цього він перекривав низ
   зони, і дотик під кнопкою провалювався в порожнє поле списку. */
.ui-toaster-toolbar {
  position: relative;
  z-index: 1;
  flex: none;
  margin: 4px 4px 2px;
  pointer-events: auto;
}

.ui-toaster-count {
  font-variant-numeric: tabular-nums;
}
.ui-toaster-viewport {
  min-height: 0;
  overflow: auto;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  pointer-events: auto;
}
/* Поля списку — місце для кільця фокуса (2px + відступ 2px): viewport
   прокручується, тож кільце біля краю інакше обрізалось би. */
.ui-toaster-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px;
}
.ui-toaster-list:empty {
  padding: 0;
}
.ui-toast-item {
  flex: none;
  min-width: 0;
}

/* Вигляд картки — утилітами в шаблоні; тут лише свайп. */
.ui-toast-card {
  touch-action: pan-y pinch-zoom;
  transform: translateX(var(--toast-drag-x, 0px));
  opacity: var(--toast-drag-opacity, 1);
  transition:
    transform var(--duration-slow) var(--ease-emphasized),
    opacity var(--duration-base) var(--ease-out);
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
.ui-toast-spinner {
  transform-origin: 12px 12px;
  animation: ui-toast-spin 0.9s linear infinite;
}

@keyframes ui-toast-spin {
  to {
    transform: rotate(360deg);
  }
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
    /* Картка 25rem (375px за кореня 15px) + поля списку. Виміряно на
       типових повідомленнях: на 360px фраза на 39–42 знаки («Перевірте
       підключення та спробуйте ще раз.») переносила одне слово, і картка
       ставала на рядок вищою — вужча картка давала ВИЩИЙ стос. */
    width: calc(25rem + 8px);
    max-height: 70vh;
    max-height: 70dvh;
  }
  .ui-toaster[data-placement='bottom-right'],
  .ui-toaster[data-placement='bottom-center'] {
    --toast-enter-y: 12px;
    top: auto;
    bottom: calc(12px + var(--toaster-offset-bottom, 0px) + env(safe-area-inset-bottom, 0px));
  }
  .ui-toaster[data-placement='bottom-center'] {
    right: auto;
    left: 50%;
    transform: translateX(-50%);
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
