<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  watch,
} from 'vue'
import { focusNextAfter, getTabbable } from '~/composables/useFocusTrap'
import { useFloatingLayer } from '~/composables/useOverlayStack'
import {
  computeAnchoredPanelPosition,
  getOverlayChildZIndex,
  type AnchoredPlacement,
} from '~/utils/overlayPosition'

const props = withDefaults(
  defineProps<{
    /** Ширина панелі, напр. `"14rem"`. Без неї — за вмістом. */
    width?: string
    /** Куди відкривати відносно тригера. Автоматично фліпається, якщо не влазить. */
    placement?: 'bottom-start' | 'bottom' | 'bottom-end' | 'top' | 'right'
    disabled?: boolean
    /** Семантика панелі: menu для команд, dialog для складених контролів. */
    panelRole?: 'menu' | 'dialog' | 'none'
    /** Доступна назва панелі, особливо для `panelRole="dialog"`. */
    ariaLabel?: string
  }>(),
  { placement: 'bottom-end', panelRole: 'menu', ariaLabel: undefined },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

defineSlots<{
  /**
   * Тригер. `triggerAttrs` потрібно передати реальній кнопці через `v-bind`,
   * а `toggle` — у `@click` без обгортки: з події він дізнається, що меню
   * відкрили з клавіатури, і ставить фокус на перший пункт.
   */
  trigger: (props: {
    toggle: (event?: Event) => void
    isOpen: boolean
    triggerAttrs: {
      'aria-haspopup': 'menu' | 'dialog' | undefined
      'aria-expanded': boolean
      'aria-controls': string | undefined
      'aria-disabled': 'true' | undefined
    }
  }) => unknown
  /** Вміст панелі. `toggle` дає змогу закрити меню з пункту. */
  content: (props: { toggle: () => void; isOpen: boolean }) => unknown
}>()

const isOpen = ref(false)
const containerEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const teleportReady = shallowRef(false)

const panelId = `${useId()}-menu`
const position = ref<Record<string, string>>({ top: '0px', left: '0px' })
const resolvedPlacement = shallowRef<AnchoredPlacement>('bottom-end')

const panelStyle = computed(() => {
  const style = { ...position.value }
  if (props.width?.trim()) style.width = props.width
  return style
})

/*
 * `right` у меню вирівнює ВЕРХНІ краї, як підменю, а не центрує панель по
 * тригеру, як поповер. Решта назв збігається зі спільною геометрією.
 */
const PLACEMENT: Record<NonNullable<typeof props.placement>, AnchoredPlacement> = {
  'bottom-start': 'bottom-start',
  bottom: 'bottom',
  'bottom-end': 'bottom-end',
  top: 'top',
  right: 'right-start',
}

/*
 * Точка, з якої панель «виростає» при відкритті. Масштабування від центру
 * виглядає як спалах на місці; від кута біля тригера — як розкриття.
 * Береться від ФАКТИЧНОГО боку після фліпу.
 */
const ORIGIN: Partial<Record<AnchoredPlacement, string>> = {
  'bottom-start': 'origin-top-left',
  bottom: 'origin-top',
  'bottom-end': 'origin-top-right',
  'top-start': 'origin-bottom-left',
  top: 'origin-bottom',
  'top-end': 'origin-bottom-right',
  'right-start': 'origin-top-left',
  'left-start': 'origin-top-right',
}

const triggerAttrs = computed(() => ({
  'aria-haspopup': props.panelRole === 'none' ? undefined : props.panelRole,
  'aria-expanded': isOpen.value,
  'aria-controls': isOpen.value ? panelId : undefined,
  'aria-disabled': props.disabled ? ('true' as const) : undefined,
}))

/*
 * Escape і клік «повз» — через спільний стек шарів. Раніше меню ігнорувало
 * натискання всередині БУДЬ-ЯКОГО [role="dialog"]: відкрите в модалці чи
 * drawer'і, воно не закривалося від кліку деінде в тій самій модалці. А
 * Escape на document у фазі захоплення закривав меню під діалогом, який із
 * нього відкрили, замість самого діалогу.
 */
const layer = useFloatingLayer({
  elements: () => [containerEl.value, menuEl.value],
  onEscape: () => close(),
  onPointerDownOutside: () => close(false),
})

/**
 * Позиція рахується спільною геометрією з utils/overlayPosition, без
 * @floating-ui: компонент має копіюватись у чужий проєкт без нової
 * залежності. Власна математика тут раніше не перевертала `top` донизу і
 * `right` ліворуч — панель притискалася до краю просто поверх тригера.
 */
function updatePosition() {
  const trigger = triggerEl.value
  if (!trigger) return

  const panel = menuEl.value
  const rect = trigger.getBoundingClientRect()
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const placement = PLACEMENT[props.placement]
  // Запасні розміри на перший прохід: до рендеру панель ще не має габаритів.
  // Висота — ПРИРОДНА (scrollHeight + рамки), а не поточна: коли панель уже
  // обмежена max-height, offsetHeight бреше про те, скільки їй треба.
  const width = panel?.offsetWidth ?? 200
  const natural = panel ? panel.scrollHeight + (panel.offsetHeight - panel.clientHeight) : 100

  let point = computeAnchoredPanelPosition(rect, { width, height: natural }, viewport, placement)
  const fits = natural <= point.maxHeight
  if (!fits) {
    point = computeAnchoredPanelPosition(rect, { width, height: point.maxHeight }, viewport, placement)
  }

  const style: Record<string, string> = {
    top: `${Math.round(point.top)}px`,
    left: `${Math.round(point.left)}px`,
    zIndex: String(getOverlayChildZIndex(trigger)),
  }
  // Прокрутка лише тоді, коли вміст справді не влазить у вікно. Постійний
  // overflow обрізав би кільця фокуса пунктів у меню, яким прокрутка не
  // потрібна, а без жодного обмеження нижні пункти довгого меню
  // опинялися за краєм екрана — недосяжні ні мишею, ні стрілками.
  if (!fits) {
    style.maxHeight = `${Math.floor(point.maxHeight)}px`
    style.overflowY = 'auto'
  }
  position.value = style
  resolvedPlacement.value = point.placement
}

function menuItems() {
  if (!menuEl.value) return []
  return Array.from(
    menuEl.value.querySelectorAll<HTMLElement>(
      '[role^="menuitem"]:not([aria-disabled="true"]), button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function focusPanelItem(fromEnd = false) {
  const items = menuItems()
  const item = fromEnd ? items[items.length - 1] : items[0]
  item?.focus()
}

function focusableTrigger() {
  return triggerEl.value?.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  ) ?? triggerEl.value
}

/**
 * Відкрити меню. `focus` — на який пункт перенести фокус після рендеру;
 * без нього фокус лишається на тригері.
 */
async function open(focus: 'first' | 'last' | false = false) {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  layer.activate()
  emit('update:open', true)
  await nextTick()
  updatePosition()
  // Друге вимірювання: перше рахувалося з запасними габаритами і могло
  // помилитися з фліпом.
  await nextTick()
  updatePosition()
  if (focus && isOpen.value) focusPanelItem(focus === 'last')
}

function close(restoreFocus = true) {
  if (!isOpen.value) return
  isOpen.value = false
  layer.deactivate()
  resetTypeahead()
  emit('update:open', false)
  // Фокус назад на тригер: без цього після закриття меню Tab починає обхід
  // з початку сторінки, і користувач втрачає місце.
  if (restoreFocus) focusableTrigger()?.focus?.()
}

/**
 * Enter і Space на кнопці дають click із `detail === 0` — це відкриття з
 * клавіатури, і фокус переходить на перший пункт (APG menu button). Мишею
 * фокус лишається на тригері: панель і так перед очима.
 */
function toggle(event?: Event) {
  if (isOpen.value) close()
  else void open(event instanceof MouseEvent && event.detail === 0 ? 'first' : false)
}

async function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const fromEnd = event.key === 'ArrowUp'
  if (!isOpen.value) return open(fromEnd ? 'last' : 'first')
  // Уже відкрите (напр. головною кнопкою UiSplitButton тим самим натиском):
  // панель іще не відрендерилась — чекаємо рендер, тоді фокус.
  await nextTick()
  focusPanelItem(fromEnd)
}

/* ------------------------------------------------------------------ */
/*  Typeahead                                                          */
/* ------------------------------------------------------------------ */

/*
 * Друк літери переводить фокус на пункт, що з неї починається (APG).
 * Буфер живе пів секунди, тож «пе» дістає «Перейменувати» повз «Печать»;
 * та сама літера кілька разів поспіль перебирає пункти на неї.
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
  // Одна літера шукає з НАСТУПНОГО пункту, слово — з поточного: інакше
  // «ек» зі «Експортувати» перестрибнуло б на інший пункт.
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

/* ------------------------------------------------------------------ */
/*  Клавіатура в панелі                                                */
/* ------------------------------------------------------------------ */

/**
 * Tab у телепортованій панелі. Нативно він вивів би фокус із кінця <body>
 * за межі сторінки, тож веземо його далі від ТРИГЕРА.
 *
 * Меню команд (APG): Tab закриває меню й іде до наступного елемента
 * сторінки, Shift+Tab — на тригер. Складена панель (`dialog`, як
 * налаштування колонок таблиці): Tab ходить її контролами й виходить лише
 * з останнього — раніше перший же Tab закривав панель із перемикачами.
 */
function onPanelTab(event: KeyboardEvent) {
  const panel = menuEl.value
  const trigger = focusableTrigger()
  if (!panel) return

  if (props.panelRole !== 'menu') {
    const items = getTabbable(panel)
    const active = document.activeElement
    const atEdge = event.shiftKey
      ? !items.length || active === items[0] || active === panel
      : !items.length || active === items[items.length - 1]
    if (!atEdge) return
  }

  event.preventDefault()
  close(false)
  if (event.shiftKey || !trigger || !focusNextAfter(trigger, [panel])) trigger?.focus()
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') return onPanelTab(event)
  if (props.panelRole !== 'menu') return
  const items = menuItems()
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

function onScrollOrResize() {
  if (isOpen.value) updatePosition()
}

// Перерахунок, коли панель нарешті отримала реальні габарити.
watch(menuEl, (el) => {
  if (el) void nextTick(updatePosition)
})

onMounted(() => {
  teleportReady.value = true
  window.addEventListener('resize', onScrollOrResize, { passive: true })
  // capture: подія scroll не спливає, тож без цього відкрита панель
  // лишалася б висіти на місці, поки контейнер під нею від'їжджає.
  window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
})

onBeforeUnmount(() => {
  resetTypeahead()
  window.removeEventListener('resize', onScrollOrResize)
  window.removeEventListener('scroll', onScrollOrResize, true)
})

defineExpose({
  /** Відкрити меню програмно; `'first'`/`'last'` переносить фокус на пункт. */
  open,
  /** Закрити меню програмно. */
  close,
})
</script>

<template>
  <div ref="containerEl" class="relative inline-block">
    <div ref="triggerEl" @keydown="onTriggerKeydown">
      <slot
        name="trigger"
        :toggle="toggle"
        :is-open="isOpen"
        :trigger-attrs="triggerAttrs"
      />
    </div>

    <Teleport to="body" :disabled="!teleportReady">
      <Transition
        enter-active-class="transition duration-(--duration-base) ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-(--duration-fast) ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <!--
          Базовий z-index — 1100, як у dropdownPanelClass з uiFieldStyles.
          Усередині модалки getOverlayChildZIndex піднімає панель над нею.
        -->
        <div
          v-if="isOpen"
          :id="panelId"
          ref="menuEl"
          :role="panelRole === 'none' ? undefined : panelRole"
          :aria-label="ariaLabel"
          class="scrollbar-thin fixed rounded-control border border-line bg-dropdown py-1 text-ink shadow-overlay"
          :class="ORIGIN[resolvedPlacement]"
          :style="panelStyle"
          @keydown="onPanelKeydown"
        >
          <slot name="content" :toggle="toggle" :is-open="isOpen" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
