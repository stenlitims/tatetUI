<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useAttrs,
  useId,
  useSlots,
  watch,
} from 'vue'
import { useOverlayLayer } from '~/composables/useOverlayStack'
import { useScrollLock } from '~/composables/useScrollLock'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useReducedMotion } from '~/composables/useReducedMotion'

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

const wrapperAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const hasCustomHeader = computed(() => !!slots.header)
const hasHeader = computed(() => hasCustomHeader.value || !!props.title || props.closable)
const hasAccessibleHeader = computed(() => hasCustomHeader.value || !!props.title)
const teleportReady = shallowRef(false)

const contentPaddingClass = computed(() => {
  if (props.noPadding) return ''
  return slots.footer ? 'p-4 sm:p-5' : 'p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5'
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

const VERTICAL_SIZES: Record<NonNullable<typeof props.size>, string> = {
  xs: 'h-[30vh]',
  sm: 'h-[45vh]',
  md: 'h-[60vh]',
  lg: 'h-[75vh]',
  xl: 'h-[90vh]',
  '2xl': 'h-[95vh]',
  full: 'h-[100dvh]',
  auto: 'h-auto max-h-[85dvh]',
}

const sizeClass = computed(() =>
  isHorizontal.value ? HORIZONTAL_SIZES[props.size] : VERTICAL_SIZES[props.size],
)

const layer = useOverlayLayer()
const scrollLock = useScrollLock()
const focusTrap = useFocusTrap(() => panelEl.value)
const prefersReducedMotion = useReducedMotion()

const transitionDuration = computed(() =>
  prefersReducedMotion.value ? 0 : { enter: 350, leave: 280 },
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
/*  Свайп для закриття (нижній drawer)                              */
/* ---------------------------------------------------------------- */

const dragOffset = ref(0)
const isDragging = ref(false)

const showDragHandle = computed(
  () => props.position === 'bottom' && props.swipeToClose && props.closable,
)

const panelStyle = computed(() => {
  if (!isDragging.value && dragOffset.value === 0) return undefined
  return {
    transform: `translateY(${dragOffset.value}px)`,
    transition: isDragging.value ? 'none' : 'transform 200ms ease-out',
  }
})

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
  isDragging.value = false

  const distance = dragOffset.value
  const elapsed = performance.now() - dragStartTime
  const velocity = elapsed > 0 ? distance / elapsed : 0
  const panelHeight = panelEl.value?.offsetHeight ?? 0

  // Закриваємо або за пройденою чвертю висоти, або за різким флінгом:
  // короткий швидкий рух — теж однозначний намір закрити.
  if (props.closable && (distance > panelHeight * 0.25 || velocity > 0.5)) {
    // Не скидаємо offset у 0, а доводимо панель донизу — інакше вона
    // стрибнула б назад на місце й лише потім поїхала закриватися.
    dragOffset.value = panelHeight
    requestClose('swipe')
    return
  }
  dragOffset.value = 0
}

function onDragStart(event: PointerEvent) {
  if (!showDragHandle.value) return
  if (event.button !== 0 && event.pointerType === 'mouse') return

  activePointerId = event.pointerId
  dragStartY = event.clientY
  dragStartTime = performance.now()
  isDragging.value = true

  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

function onHeaderPointerDown(event: PointerEvent) {
  if (!showDragHandle.value) return
  onDragStart(event)
}

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
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void handleOpen()
    else handleClose()
  },
)

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (!props.modelValue || !layer.isTopmost.value) return
  if (props.persistent || !props.closable) return
  event.stopPropagation()
  requestClose('escape')
}

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('keydown', onKeyDown)
  if (props.modelValue) void handleOpen()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
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
        :class="[POSITION_CLASSES[position], positionModifierClass, attrs.class]"
        :style="{ zIndex: layer.zIndex.value }"
        v-bind="wrapperAttrs"
        @pointerdown="onRootPointerDown"
        @click="onRootClick"
      >
        <div ref="backdropEl" class="ui-drawer-backdrop absolute inset-0 bg-backdrop/50 backdrop-blur-sm" />

        <div
          ref="panelEl"
          class="ui-drawer-panel relative flex max-h-[100dvh] flex-col overflow-hidden border-line bg-card shadow-overlay outline-none"
          :class="[
            sizeClass,
            isHorizontal ? 'h-full' : 'w-full',
            ROUNDING[position],
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
          :aria-labelledby="hasAccessibleHeader ? titleId : undefined"
          :aria-label="hasAccessibleHeader ? undefined : 'Бічна панель'"
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

          <div
            v-if="hasHeader"
            class="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-subtle px-4 py-3"
            :class="showDragHandle ? 'touch-none' : ''"
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
              Хрестик лишається дрібним (h-8 = 30px) — це вторинна дія в
              шапці, збільшувати заливку означало б сперечатися з назвою
              панелі. Тому точність дотику тримає невидима зона 45×45 через
              `pointer-coarse:after:` — той самий патерн, що в UiButton і
              UiSwitch. Без неї на телефоні єдина кнопка закриття була
              нижчою за мінімальну ціль у 44px (W3C 2.5.8 Target Size).
              `relative` тут не декор: без нього `::after` рахував би
              зміщення від шапки, а не від кнопки.
            -->
            <button
              v-if="closable"
              type="button"
              class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line bg-card text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
              aria-label="Закрити"
              @click="requestClose('button')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            class="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
            :class="contentPaddingClass"
          >
            <slot />
          </div>

          <div
            v-if="$slots.footer"
            class="flex shrink-0 flex-wrap justify-end gap-3 border-t border-line bg-subtle px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4"
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
 */
.ui-drawer-enter-active .ui-drawer-backdrop,
.ui-drawer-leave-active .ui-drawer-backdrop {
  transition: opacity 300ms ease-out;
}

.ui-drawer-enter-from .ui-drawer-backdrop,
.ui-drawer-leave-to .ui-drawer-backdrop {
  opacity: 0;
}

.ui-drawer-enter-active .ui-drawer-panel {
  transition: transform 350ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ui-drawer-leave-active .ui-drawer-panel {
  transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
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
