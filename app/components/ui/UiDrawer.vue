<script setup lang="ts">
import { uiText } from '~/composables/useUiText'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  useId,
  useSlots,
  watch,
} from 'vue'
import { useLazyTeleport } from '~/composables/useLazyTeleport'
import { useOverlayLayer } from '~/composables/useOverlayStack'
import { useScrollLock } from '~/composables/useScrollLock'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { readDurationToken, useReducedMotion } from '~/composables/useReducedMotion'
import { useScrollEdges } from '~/composables/useScrollEdges'
import { bindSwipe, inHorizontalScroll, swipeBackCommits } from '~/utils/swipe'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /** Заголовок. Ігнорується, якщо задано слот `header`. */
    title?: string
    /** З якого краю виїжджає панель. */
    position?: 'left' | 'right' | 'top' | 'bottom'
    /** Розмір поперек напрямку: ширина для left/right, висота для top/bottom. */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'auto'
    /** Показувати хрестик і дозволяти закриття через Escape. */
    closable?: boolean
    /** Додаткові класи панелі. Якщо задано, замінює стандартний фон. */
    panelClass?: string
    /** Прибрати внутрішні відступи вмісту. */
    noPadding?: boolean
    /**
     * Клік по затемненому фону закриває drawer.
     *
     * Типово ВИМКНЕНО — на відміну від UiModal. Drawer майже завжди
     * містить форму, і випадковий клік повз панель не має знищувати
     * незбережене введення.
     */
    closeOnBackdrop?: boolean
    /** Ні Escape, ні клік по фону не закривають — лише явна дія. */
    persistent?: boolean
    /**
     * CSS-селектор усередині панелі, якому віддати фокус при відкритті.
     * Типово фокус отримує сама панель — щоб на мобільних не піднімалася
     * клавіатура.
     */
    initialFocus?: string
    /** Свайп вниз закриває нижній drawer. Вимикається, якщо заважає. */
    swipeToClose?: boolean
    /**
     * Свайп до краю закриває бічний drawer: лівий — ліворуч, правий —
     * праворуч. Панель іде за пальцем із будь-якого місця; вертикальна
     * прокрутка вмісту й області `overflow-x-auto` лишаються пальцю.
     *
     * Типово ВИМКНЕНО: у бічній панелі буває вміст, що сам слухає
     * горизонтальні рухи пальця (повзунки, полотно, карта).
     */
    swipeToCloseSide?: boolean
    /**
     * Доступне ім'я панелі, коли слот `header` не є заголовком.
     *
     * Без нього aria-labelledby вказує на контейнер слота, і якщо там
     * лежить поле вводу — ім'я панелі обчислюється з його ЗНАЧЕННЯ, як це
     * було з пошуком у UiModal.
     */
    ariaLabel?: string
  }>(),
  {
    modelValue: false,
    title: '',
    position: 'right',
    size: 'lg',
    closable: true,
    panelClass: '',
    noPadding: false,
    closeOnBackdrop: false,
    persistent: false,
    swipeToClose: true,
    swipeToCloseSide: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

defineSlots<{
  /** Вміст панелі. */
  default?: () => unknown
  /** Замінює заголовок цілком. Тоді `title` не використовується. */
  header?: () => unknown
  /** Кнопки дій. Футер не рендериться, якщо слот порожній. */
  footer?: () => unknown
}>()

const attrs = useAttrs()
const slots = useSlots()

const generatedId = useId()
const titleId = `${generatedId}-title`

const backdropEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)

// Лінії під шапкою й над футером — лише коли вміст справді ховається за ними.
const { scrolledFromTop, moreBelow } = useScrollEdges(() => bodyEl.value)

const wrapperAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const hasCustomHeader = computed(() => !!slots.header)
const hasHeader = computed(() => hasCustomHeader.value || !!props.title || props.closable)
const hasAccessibleHeader = computed(() => hasCustomHeader.value || !!props.title)
// Teleport — з першим відкриттям, без повторного рендеру після монтування.
const teleportReady = useLazyTeleport(() => props.modelValue)

// По одному класу на бік. Під пласкою шапкою відступ над текстом дає вона
// сама — як у UiModal; без футера знизу враховуємо home indicator на iOS.
const contentPaddingClass = computed(() => {
  if (props.noPadding) return ''
  const top = hasHeader.value ? 'pt-1' : 'pt-4 sm:pt-5'
  const bottom = slots.footer ? 'pb-4 sm:pb-5' : 'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5'
  return `px-4 sm:px-5 ${top} ${bottom}`
})

const POSITION_CLASSES: Record<NonNullable<typeof props.position>, string> = {
  left: 'justify-start items-stretch',
  right: 'justify-end items-stretch',
  top: 'items-start',
  bottom: 'items-end',
}

/*
 * Напрямок анімації задаємо МОДИФІКАТОРОМ на корені, а не окремою назвою
 * <Transition>. Інакше довелося б дублювати весь набір enter/leave-класів
 * чотири рази — по разу на кожен бік.
 */
const positionModifierClass = computed(() => `ui-drawer--${props.position}`)

const isHorizontal = computed(() => props.position === 'left' || props.position === 'right')

// Нижній/верхній drawer — фактично sheet, тож зі скругленим краєм.
const ROUNDING: Record<NonNullable<typeof props.position>, string> = {
  bottom: 'rounded-t-overlay',
  top: 'rounded-b-overlay',
  left: '',
  right: '',
}

/*
 * Краї екрана, до яких прилягає панель, можуть лежати під вирізом камери,
 * рядком стану чи заокругленням кутів (iPhone у ландшафті, сайт,
 * встановлений на головний екран). env() дорівнює нулю там, де вирізу
 * немає, тож на десктопі це не змінює нічого. Нижній край уже враховано
 * у футері й паддінгу вмісту.
 *
 * Працює лише з `viewport-fit=cover` у meta viewport — без нього браузер
 * сам тримає сторінку поза вирізами, і всі env() дорівнюють нулю.
 */
const SAFE_AREA: Record<NonNullable<typeof props.position>, string> = {
  left: 'pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]',
  right: 'pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]',
  top: 'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]',
  bottom: 'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
}

/*
 * Розміри розділені по осях: та сама назва `md` означає ширину для
 * бокового drawer'а і висоту для нижнього.
 *
 * До md: усі бокові — на всю ширину. Панель у 540px на телефоні лишила б
 * смужку фону збоку, яку неможливо натиснути пальцем повз панель.
 */
const HORIZONTAL_SIZES: Record<NonNullable<typeof props.size>, string> = {
  xs: 'w-[85vw] max-w-[320px] sm:w-[320px]',
  sm: 'w-full md:w-[540px]',
  md: 'w-full md:w-[720px]',
  lg: 'w-full md:w-[900px]',
  xl: 'w-full md:w-[1080px]',
  '2xl': 'w-full md:w-[1350px]',
  full: 'w-full',
  auto: 'w-auto max-w-[95vw]',
}

/*
 * dvh, а не vh. На телефоні 1vh рахується від ВЕЛИКОГО вікна — без панелі
 * адреси, — тож нижній sheet `xl` (90vh) при видимій панелі браузера був
 * вищим за екран, і його шапка з хрестиком ховалася під верхнім краєм.
 */
const VERTICAL_SIZES: Record<NonNullable<typeof props.size>, string> = {
  xs: 'h-[30dvh]',
  sm: 'h-[45dvh]',
  md: 'h-[60dvh]',
  lg: 'h-[75dvh]',
  xl: 'h-[90dvh]',
  '2xl': 'h-[95dvh]',
  full: 'h-[100dvh]',
  auto: 'h-auto max-h-[85dvh]',
}

const sizeClass = computed(() =>
  isHorizontal.value ? HORIZONTAL_SIZES[props.size] : VERTICAL_SIZES[props.size],
)

/*
 * Запасне ім'я — за краєм. «Бічна панель» для нижнього sheet'а вводила
 * скрінрідер в оману щодо того, де шукати панель на екрані.
 */
const FALLBACK_LABEL: Record<NonNullable<typeof props.position>, string> = {
  get left() { return uiText("Бічна панель") },
  get right() { return uiText("Бічна панель") },
  get top() { return uiText("Верхня панель") },
  get bottom() { return uiText("Нижня панель") },
}

// Escape — через спільний стек: підказка чи меню в панелі отримують його
// першими, і один натиск не закриває разом із ними форму в drawer'і.
const layer = useOverlayLayer(undefined, {
  onEscape: () => {
    if (props.modelValue && !props.persistent && props.closable) requestClose('escape')
  },
})
const scrollLock = useScrollLock()
const focusTrap = useFocusTrap(() => panelEl.value)
const prefersReducedMotion = useReducedMotion()

// Числа — з тих самих токенів, що й CSS нижче: перевизначений
// --duration-slow інакше обрізав би анімацію.
const transitionDuration = computed(() =>
  prefersReducedMotion.value
    ? 0
    : { enter: readDurationToken('--duration-slow', 260), leave: readDurationToken('--duration-base', 180) },
)

function closeDrawer() {
  emit('update:modelValue', false)
  emit('close')
}

type CloseReason = 'button' | 'escape' | 'backdrop' | 'swipe'

function requestClose(reason: CloseReason) {
  if (!props.closable) return
  if (reason !== 'button' && reason !== 'swipe' && props.persistent) return
  if (reason === 'backdrop' && !props.closeOnBackdrop) return
  closeDrawer()
}

// Клік по фону зараховуємо, лише якщо натискання і почалося, і завершилося
// на фоні: інакше виділення тексту зсередини панелі закривало б drawer.
let pressedOnBackdrop = false

function onRootPointerDown(event: PointerEvent) {
  pressedOnBackdrop = event.target === backdropEl.value
}

function onRootClick(event: MouseEvent) {
  if (!pressedOnBackdrop) return
  pressedOnBackdrop = false
  if (event.target !== backdropEl.value) return
  requestClose('backdrop')
}

/* ---------------------------------------------------------------- */
/*  Свайп для закриття                                              */
/* ---------------------------------------------------------------- */

/** Зсув панелі за пальцем, px: униз — для нижньої, до краю — для бічних. */
const dragOffset = ref(0)
const isDragging = ref(false)
/** Палець відпущено без закриття: панель плавно повертається на місце. */
const isSettling = ref(false)
/** Ширина бічної панелі на початку жесту: від неї частка й затемнення. */
const dragExtent = ref(0)

const showDragHandle = computed(
  () => props.position === 'bottom' && props.swipeToClose && props.closable,
)

const sideSwipe = computed(() => isHorizontal.value && props.swipeToCloseSide && props.closable)

const panelStyle = computed(() => {
  if (!isDragging.value && !isSettling.value && dragOffset.value === 0) return undefined
  return {
    transform: isHorizontal.value ? `translateX(${dragOffset.value}px)` : `translateY(${dragOffset.value}px)`,
    transition: isDragging.value ? 'none' : 'transform var(--duration-base) var(--ease-out)',
  }
})

// Фон бічного drawer'а світлішає разом із жестом — як у мобільних
// застосунках, видно, що панель відпускає сторінку. Нижній фон не чіпаємо.
const backdropStyle = computed(() => {
  if (!isHorizontal.value || !dragExtent.value) return undefined
  if (!isDragging.value && !isSettling.value && dragOffset.value === 0) return undefined
  return {
    opacity: 1 - Math.min(1, Math.abs(dragOffset.value) / dragExtent.value),
    transition: isDragging.value ? 'none' : 'opacity var(--duration-base) var(--ease-out)',
  }
})

/*
 * Повернення на місце — з анімацією. Скинути offset у 0 й одразу прибрати
 * інлайн-стиль означало б прибрати разом із ним і transition: панель
 * стрибала б на місце. Таймер, а не transitionend: у фоновій вкладці
 * подія може не прийти.
 */
let settleTimer: ReturnType<typeof setTimeout> | null = null

function settleBack() {
  isSettling.value = true
  dragOffset.value = 0
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    settleTimer = null
    isSettling.value = false
  }, readDurationToken('--duration-base', 180) + 80)
}

/**
 * Палець відпущено: або доводимо панель за край і просимо закрити, або
 * повертаємо на місце. `edge` — зсув, за яким панель уже поза екраном.
 */
function finishSwipe(commit: boolean, edge: number) {
  isDragging.value = false
  if (!commit) return settleBack()
  // Не скидаємо offset у 0, а доводимо панель за край — інакше вона
  // стрибнула б назад на місце й лише потім поїхала закриватися.
  dragOffset.value = edge
  requestClose('swipe')
  // Батько може відмовити в закритті (керований v-model з питанням
  // «Відкинути незбережені зміни?»). Тоді панель лишалася зсунутою за
  // край: невидима, але з фоном, блоком прокрутки й інертною сторінкою.
  void nextTick(() => {
    if (props.modelValue) settleBack()
  })
}

/* Нижній: ручка й шапка, вертикальний рух. */

let dragStartY = 0
let dragStartTime = 0
let activePointerId: number | null = null

function onDragMove(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return
  // Тягнути можна лише вниз — угору панель не «відлипає».
  dragOffset.value = Math.max(0, event.clientY - dragStartY)
}

function onDragEnd(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return

  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
  activePointerId = null

  const distance = dragOffset.value
  const elapsed = performance.now() - dragStartTime
  const velocity = elapsed > 0 ? distance / elapsed : 0
  const panelHeight = panelEl.value?.offsetHeight ?? 0

  // Закриваємо або за пройденою чвертю висоти, або за різким флінгом:
  // короткий швидкий рух — теж однозначний намір закрити.
  finishSwipe(props.closable && (distance > panelHeight * 0.25 || velocity > 0.5), panelHeight)
}

function onDragStart(event: PointerEvent) {
  if (!showDragHandle.value) return
  if (event.button !== 0 && event.pointerType === 'mouse') return

  activePointerId = event.pointerId
  dragStartY = event.clientY
  dragStartTime = performance.now()
  isSettling.value = false
  isDragging.value = true

  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

function onHeaderPointerDown(event: PointerEvent) {
  if (!showDragHandle.value) return
  onDragStart(event)
}

/*
 * Бічний: з будь-якого місця панелі, горизонтальний рух до краю. Спільне
 * ядро свайпів бере жест лише за явно горизонтального руху (вертикальний
 * лишається прокрутці), не починає його з полів, повзунків і полотна, гасить
 * клік, що прийшов слідом за свайпом, і не реагує на мишу.
 */
let unbindSideSwipe: (() => void) | null = null

watch(
  [panelEl, sideSwipe, () => props.position] as const,
  ([el, enabled, position]) => {
    unbindSideSwipe?.()
    unbindSideSwipe = null
    if (!el || !enabled) return
    // Знак руху до краю, біля якого стоїть панель.
    const toEdge = position === 'left' ? -1 : 1
    unbindSideSwipe = bindSwipe(el, {
      direction: position === 'left' ? 'left' : 'right',
      // Область, що прокручується вбік, лишається пальцю.
      canStart: (event) => props.modelValue && !inHorizontalScroll(event.target, el),
      onStart: () => {
        dragExtent.value = el.offsetWidth
        isSettling.value = false
        isDragging.value = true
      },
      onMove: (dx) => {
        dragOffset.value = dx
      },
      // Далі ~третини ширини або кидок до краю; кидок назад — скасування.
      onEnd: ({ dx, velocity, cancelled }) => {
        const commit =
          !cancelled && props.closable && swipeBackCommits(dx * toEdge, velocity * toEdge, dragExtent.value, 1 / 3)
        finishSwipe(commit, toEdge * dragExtent.value)
      },
    })
  },
  { flush: 'post' },
)

/* ---------------------------------------------------------------- */
/*  Життєвий цикл                                                   */
/* ---------------------------------------------------------------- */

async function handleOpen() {
  layer.activate()
  scrollLock.lock()
  await nextTick()
  focusTrap.activate({ initialFocus: props.initialFocus ?? null })
}

function handleClose() {
  focusTrap.deactivate()
  scrollLock.unlock()
  layer.deactivate()
}

function onAfterLeave() {
  layer.settle()
  dragOffset.value = 0
  isSettling.value = false
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void handleOpen()
    else handleClose()
  },
)

onMounted(() => {
  if (props.modelValue) void handleOpen()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
  unbindSideSwipe?.()
  if (settleTimer) clearTimeout(settleTimer)
  handleClose()
})
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <Transition name="ui-drawer" :duration="transitionDuration" @after-leave="onAfterLeave">
      <div
        v-if="modelValue"
        data-ui-overlay
        class="ui-drawer fixed inset-0 flex"
        :class="[POSITION_CLASSES[position], positionModifierClass, sideSwipe ? 'ui-drawer--swipe' : '', attrs.class]"
        :style="{ zIndex: layer.zIndex.value }"
        v-bind="wrapperAttrs"
        @pointerdown="onRootPointerDown"
        @click="onRootClick"
      >
        <div
          ref="backdropEl"
          class="ui-drawer-backdrop absolute inset-0 bg-backdrop/50 backdrop-blur-sm"
          :style="backdropStyle"
        />

        <div
          ref="panelEl"
          class="ui-drawer-panel relative flex max-h-[100dvh] flex-col overflow-hidden border-line bg-card shadow-overlay outline-none"
          :class="[
            sizeClass,
            isHorizontal ? 'h-full' : 'w-full',
            ROUNDING[position],
            SAFE_AREA[position],
            position === 'right' ? 'border-l' : '',
            position === 'left' ? 'border-r' : '',
            position === 'bottom' ? 'border-t' : '',
            position === 'top' ? 'border-b' : '',
            panelClass,
          ]"
          :style="panelStyle"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="!ariaLabel && hasAccessibleHeader ? titleId : undefined"
          :aria-label="ariaLabel || (hasAccessibleHeader ? undefined : FALLBACK_LABEL[position])"
        >
          <!-- Ручка свайпу. touch-none обов'язковий: без нього браузер
               забирає вертикальний жест собі як прокрутку сторінки. -->
          <div
            v-if="showDragHandle"
            class="flex shrink-0 cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
            @pointerdown="onDragStart"
          >
            <span class="h-1 w-10 rounded-full bg-line-strong" />
          </div>

          <!--
            Шапка пласка, як у UiModal і діалогах GNOME: те саме тло, що й
            вміст, а лінія під нею з'являється лише тоді, коли вміст
            прокручено під шапку. Колір межі обирається в JS, а не
            дописується поверх: два класи кольору межі на одному вузлі
            вирішував би порядок у згенерованому CSS.
          -->
          <div
            v-if="hasHeader"
            class="flex shrink-0 items-center justify-between gap-3 border-b py-3 pr-3 pl-4 transition-[border-color] sm:pl-5"
            :class="[scrolledFromTop ? 'border-line' : 'border-transparent', showDragHandle ? 'touch-none' : '']"
            @pointerdown="onHeaderPointerDown"
          >
            <div
              :id="hasAccessibleHeader ? titleId : undefined"
              class="flex min-w-0 flex-1 items-center gap-3"
            >
              <slot name="header">
                <h3 class="m-0 truncate text-lg font-semibold tracking-tight text-ink">
                  {{ title }}
                </h3>
              </slot>
            </div>
            <!--
              Хрестик — велике кругле тло без рамки, розмітка однакова з
              UiModal. Раніше він був дрібним квадратом у рамці (30px), щоб не
              сперечатися з назвою панелі; але сперечалася саме рамка, а не
              розмір: м'яка підкладка кольору `ink` під 10% альфи лишає
              хрестик тихим, і водночас у нього легко влучити.

              Точність дотику на телефоні тримає невидима зона 45×45 через
              `pointer-coarse:after:` (W3C 2.5.8 Target Size). `relative` тут
              не декор: без нього `::after` рахував би зміщення від шапки.
            -->
            <button
              v-if="closable"
              type="button"
              class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/10 text-muted transition-colors hover:bg-ink/15 hover:text-ink active:bg-ink/20 active:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
              :aria-label="uiText('Закрити')"
              @click="requestClose('button')"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div
            ref="bodyEl"
            class="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
            :class="contentPaddingClass"
          >
            <slot />
          </div>

          <!-- Футер теж плаский: лінія над ним — лише коли під кнопками
               лишився непрокручений вміст. -->
          <div
            v-if="$slots.footer"
            class="flex shrink-0 flex-wrap justify-end gap-3 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[border-color] sm:px-5 sm:pb-5"
            :class="moreBelow ? 'border-line' : 'border-transparent'"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
 * Одна <Transition> на корені замість двох вкладених.
 *
 * У вихідному коді зовнішня тримала backdrop, а внутрішня — панель, обидві
 * на тому самому v-if. Дитина створювалася в тому ж рендері, що й батько,
 * тож без `appear` enter не запускався, а на leave батьківський вузол
 * зникав разом із піддеревом — і leave теж не запускався. Тобто ВСІ
 * drawer-slide-* анімації були мертвим кодом: видно було лише
 * opacity-фейд усього блоку.
 *
 * Тривалість задана явно через :duration, бо transition-и висять на дітях.
 * Поява — --duration-slow, вихід — --duration-base: ті самі ролі, що в
 * tokens.css, UiModal і transitionDuration у скрипті.
 */
.ui-drawer-enter-active .ui-drawer-backdrop {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.ui-drawer-leave-active .ui-drawer-backdrop {
  transition: opacity var(--duration-base) var(--ease-in);
}

.ui-drawer-enter-from .ui-drawer-backdrop,
.ui-drawer-leave-to .ui-drawer-backdrop {
  opacity: 0;
}

.ui-drawer-enter-active .ui-drawer-panel {
  transition: transform var(--duration-slow) var(--ease-emphasized);
}

.ui-drawer-leave-active .ui-drawer-panel {
  transition: transform var(--duration-base) var(--ease-emphasized);
}

.ui-drawer--left.ui-drawer-enter-from .ui-drawer-panel,
.ui-drawer--left.ui-drawer-leave-to .ui-drawer-panel {
  transform: translateX(-100%);
}

.ui-drawer--right.ui-drawer-enter-from .ui-drawer-panel,
.ui-drawer--right.ui-drawer-leave-to .ui-drawer-panel {
  transform: translateX(100%);
}

.ui-drawer--top.ui-drawer-enter-from .ui-drawer-panel,
.ui-drawer--top.ui-drawer-leave-to .ui-drawer-panel {
  transform: translateY(-100%);
}

.ui-drawer--bottom.ui-drawer-enter-from .ui-drawer-panel,
.ui-drawer--bottom.ui-drawer-leave-to .ui-drawer-panel {
  transform: translateY(100%);
}

/*
 * Бічний свайп. Панель і кожна вертикальна область прокрутки в ній лишають
 * браузеру лише вертикальне панорамування, інакше він забирав би
 * горизонтальний рух собі й слав pointercancel. Область прокрутки знову
 * вмикає панорамування для своїх дітей, тож значення з панелі до них не
 * доходить — звідси :deep. Прокрутку вбік (`overflow-x-auto`) не чіпаємо:
 * там палець прокручує вміст (див. utils/swipe.ts).
 */
.ui-drawer--swipe .ui-drawer-panel,
.ui-drawer--swipe .ui-drawer-panel :deep(.overflow-y-auto:not(.overflow-x-auto)) {
  touch-action: pan-y pinch-zoom;
}

@media (prefers-reduced-motion: reduce) {
  .ui-drawer-enter-active .ui-drawer-backdrop,
  .ui-drawer-leave-active .ui-drawer-backdrop,
  .ui-drawer-enter-active .ui-drawer-panel,
  .ui-drawer-leave-active .ui-drawer-panel {
    transition-duration: 1ms;
  }

  .ui-drawer-enter-from .ui-drawer-panel,
  .ui-drawer-leave-to .ui-drawer-panel {
    transform: none;
  }
}
</style>
