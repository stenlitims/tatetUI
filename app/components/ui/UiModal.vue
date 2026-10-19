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

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /** Заголовок. Ігнорується, якщо задано слот `header`. */
    title?: string
    /** Ширина панелі. */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    /** Додаткові класи панелі — коли готових розмірів не вистачає. */
    panelClass?: string
    /**
     * Стабільний id шару в стеку оверлеїв. Задавати не обов'язково:
     * без нього генерується автоматично.
     */
    modalId?: string
    /** Показувати хрестик і дозволяти закриття через Escape. */
    closable?: boolean
    /**
     * Клік по затемненому фону закриває вікно.
     *
     * Типово `true` — на відміну від UiDrawer, де типово `false`.
     * Модалка зазвичай інформаційна, і випадкове закриття нічого не коштує;
     * drawer майже завжди містить форму, де це втрата введеного.
     */
    closeOnBackdrop?: boolean
    /** Ні Escape, ні клік по фону не закривають — лише явна дія. */
    persistent?: boolean
    /** Прибрати внутрішні відступи вмісту. */
    noPadding?: boolean
    /**
     * CSS-селектор усередині панелі, якому віддати фокус при відкритті.
     *
     * Типово фокус отримує сама панель, а НЕ перший інпут: на мобільних
     * автофокус в інпуті одразу піднімає клавіатуру і з'їдає пів екрана.
     */
    initialFocus?: string
    /**
     * Доступне ім'я діалогу, коли слот `header` не є заголовком.
     *
     * Без нього aria-labelledby вказує на контейнер слота, і якщо там
     * лежить поле вводу — ім'я вікна обчислюється з його ЗНАЧЕННЯ. Діалог
     * пошуку оголошувався як «Діалог: тек» на слові «текст».
     */
    ariaLabel?: string
    /**
     * Роль панелі. `alertdialog` — для підтверджень, що переривають роботу
     * і чекають відповіді (UiConfirmDialog): скрінрідер оголошує їх як
     * попередження, а не як звичайне вікно.
     */
    role?: 'dialog' | 'alertdialog'
    /**
     * id елемента з поясненням, що саме відбувається. Потрапляє в
     * `aria-describedby` панелі: коли фокус одразу стрибає на кнопку,
     * без цього скрінрідер оголошує лише заголовок і кнопку, пропускаючи
     * сам текст повідомлення.
     */
    ariaDescribedby?: string
    /**
     * Свайп униз закриває вікно, поки воно bottom sheet (до `sm`): над
     * шапкою з'являється ручка, тягнути можна за неї й за шапку. Як і
     * хрестик, свайп — явна дія: працює з `closable`, навіть якщо вікно
     * `persistent`. Ширше `sm` вікно центроване, і жест вимкнено.
     */
    swipeToClose?: boolean
  }>(),
  {
    modelValue: false,
    title: '',
    size: 'lg',
    role: 'dialog',
    panelClass: '',
    closable: true,
    closeOnBackdrop: true,
    persistent: false,
    noPadding: false,
    swipeToClose: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

defineSlots<{
  /** Вміст вікна. */
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

// class обробляємо окремо через :class, решту атрибутів прокидаємо на корінь.
const wrapperAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const hasCustomHeader = computed(() => !!slots.header)
const hasHeader = computed(() => hasCustomHeader.value || !!props.title || props.closable)
const hasAccessibleHeader = computed(() => hasCustomHeader.value || !!props.title)
// Teleport — з першим відкриттям, без повторного рендеру після монтування.
const teleportReady = useLazyTeleport(() => props.modelValue)

const SIZE_CLASSES: Record<NonNullable<typeof props.size>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[96rem]',
}

/*
 * Відступи — по одному класу на бік, без `p-*` під `pb-*`.
 *
 * Шапка пласка й того ж тла, що вміст, тож відступ над текстом уже дає вона
 * сама: повний `pt-5` відсував би перший абзац від заголовка далі, ніж абзаци
 * одне від одного, і заголовок «відривався» б від свого тексту.
 * Без футера нижній відступ має враховувати home indicator на iOS.
 */
const contentPaddingClass = computed(() => {
  if (props.noPadding) return ''
  const top = hasHeader.value ? 'pt-1' : 'pt-4 sm:pt-5'
  const bottom = slots.footer ? 'pb-4 sm:pb-5' : 'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5'
  return `px-4 sm:px-5 ${top} ${bottom}`
})

/*
 * Escape — через спільний стек, а не власний слухач на document: так
 * підказка чи меню, відкриті всередині вікна, отримують його першими, і
 * один натиск не закриває і їх, і вікно з незбереженою формою.
 */
const layer = useOverlayLayer(props.modalId, {
  onEscape: () => {
    if (props.modelValue && !props.persistent && props.closable) requestClose('escape')
  },
})
const scrollLock = useScrollLock()
const focusTrap = useFocusTrap(() => panelEl.value)
const prefersReducedMotion = useReducedMotion()

// Тривалість задана явно, бо transition-и висять на ДІТЯХ — Vue не може
// вивести її з кореневого елемента. Без useReducedMotion панель чекала б
// повні 200 мс у DOM навіть із вимкненими анімаціями. Числа — з токенів,
// що й CSS нижче: інакше перевизначений --duration-slow обрізав би вихід.
const transitionDuration = computed(() =>
  prefersReducedMotion.value
    ? 0
    : { enter: readDurationToken('--duration-slow', 260), leave: readDurationToken('--duration-base', 180) },
)

function closeModal() {
  emit('update:modelValue', false)
  emit('close')
}

type CloseReason = 'button' | 'escape' | 'backdrop' | 'swipe'

function requestClose(reason: CloseReason) {
  if (!props.closable) return
  if (reason !== 'button' && reason !== 'swipe' && props.persistent) return
  if (reason === 'backdrop' && !props.closeOnBackdrop) return
  closeModal()
}

/*
 * Клік по фону рахуємо лише тоді, коли на фоні почалося І закінчилося
 * натискання. Інакше виділення тексту зсередини панелі з відпусканням
 * мишки над фоном закриває вікно разом із незбереженою формою — класичний
 * спосіб втратити заповнену форму одним рухом.
 */
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
/*  Свайп для закриття (bottom sheet до sm)                           */
/* ---------------------------------------------------------------- */

/*
 * Той самий жест, що в нижньому UiDrawer: тягнеться лише вниз, закриває за
 * чвертю висоти або різким кидком. Лише поки вікно — sheet: центроване
 * вікно від `sm` за шапку не тягають. Межа — та сама, що в класах `sm:`.
 */
const SHEET_QUERY = '(max-width: 39.99rem)'

const dragOffset = ref(0)
const isDragging = ref(false)

const showDragHandle = computed(() => props.swipeToClose && props.closable)

const panelStyle = computed(() => {
  if (!isDragging.value && dragOffset.value === 0) return undefined
  return {
    transform: `translateY(${dragOffset.value}px)`,
    transition: isDragging.value ? 'none' : 'transform var(--duration-base) var(--ease-out)',
  }
})

let dragStartY = 0
let dragStartTime = 0
let activePointerId: number | null = null

function isSheet() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(SHEET_QUERY).matches
}

function stopDragListeners() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
}

function onDragMove(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return
  // Тягнути можна лише вниз — угору панель не «відлипає».
  dragOffset.value = Math.max(0, event.clientY - dragStartY)
}

function onDragEnd(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return
  stopDragListeners()
  activePointerId = null
  isDragging.value = false

  const distance = dragOffset.value
  const elapsed = performance.now() - dragStartTime
  const velocity = elapsed > 0 ? distance / elapsed : 0
  const panelHeight = panelEl.value?.offsetHeight ?? 0

  if (event.type === 'pointerup' && (distance > panelHeight * 0.25 || velocity > 0.5)) {
    // Доводимо панель донизу, а не скидаємо в 0: інакше вона стрибнула б
    // на місце й лише потім поїхала б закриватися.
    dragOffset.value = panelHeight
    requestClose('swipe')
    // Батько може відмовити (керований v-model з питанням «Відкинути
    // зміни?») — тоді панель мусить повернутися, а не висіти за краєм.
    void nextTick(() => {
      if (props.modelValue) dragOffset.value = 0
    })
    return
  }
  dragOffset.value = 0
}

function onDragStart(event: PointerEvent) {
  if (!showDragHandle.value || !isSheet() || activePointerId !== null) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  activePointerId = event.pointerId
  dragStartY = event.clientY
  dragStartTime = performance.now()
  isDragging.value = true
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

/** Шапка теж тягне, але не з її кнопок і полів: там палець натискає й друкує. */
function onHeaderPointerDown(event: PointerEvent) {
  const target = event.target as Element | null
  if (target?.closest('button, a, input, textarea, select, [contenteditable="true"]')) return
  onDragStart(event)
}

function onAfterLeave() {
  layer.settle()
  dragOffset.value = 0
}

async function handleOpen() {
  layer.activate()
  scrollLock.lock()
  await nextTick()
  focusTrap.activate({ initialFocus: props.initialFocus ?? null })
}

function handleClose() {
  focusTrap.deactivate()
  scrollLock.unlock()
  // Шар знімаємо одразу (щоб Escape коректно дістався наступного оверлея),
  // а z-index лишається зафіксованим до кінця анімації виходу.
  layer.deactivate()
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
  stopDragListeners()
  // Компонент могли знищити відкритим (навігація) — handleClose знімає і
  // лок прокрутки, і пастку фокуса, і шар зі стеку.
  handleClose()
})
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <Transition name="ui-modal" :duration="transitionDuration" @after-leave="onAfterLeave">
      <div
        v-if="modelValue"
        data-ui-overlay
        class="ui-modal fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
        :class="attrs.class"
        :style="{ zIndex: layer.zIndex.value }"
        v-bind="wrapperAttrs"
        @pointerdown="onRootPointerDown"
        @click="onRootClick"
      >
        <div ref="backdropEl" class="ui-modal-backdrop absolute inset-0 bg-backdrop/50 backdrop-blur-sm" />

        <!-- Знизу до sm — bottom sheet, вище — центроване вікно. Це не
             декор: на телефоні центроване вікно з клавіатурою не вміщається. -->
        <div
          ref="panelEl"
          class="ui-modal-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-overlay border border-line bg-card shadow-overlay outline-none sm:max-h-[85dvh] sm:rounded-overlay"
          :class="[SIZE_CLASSES[size], panelClass]"
          :style="panelStyle"
          :role="role"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="!ariaLabel && hasAccessibleHeader ? titleId : undefined"
          :aria-label="ariaLabel || (hasAccessibleHeader ? undefined : uiText('Діалогове вікно'))"
          :aria-describedby="ariaDescribedby"
        >
          <!-- Ручка свайпу — лише в режимі sheet. touch-none обов'язковий:
               без нього браузер забирає вертикальний жест собі як прокрутку. -->
          <div
            v-if="showDragHandle"
            class="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-0.5 active:cursor-grabbing sm:hidden"
            aria-hidden="true"
            @pointerdown="onDragStart"
          >
            <span class="h-1 w-10 rounded-full bg-line-strong" />
          </div>

          <!--
            Шапка пласка, як у діалогах GNOME: те саме тло, що й вміст, і без
            постійної лінії. Окрема смуга з власним тлом і межею ділила навіть
            коротке питання на коробки й робила вікно важчим за його зміст.
            Лінія з'являється, лише коли вміст прокручено під шапку, — тоді
            вона показує, що вгорі є ще текст. Колір межі обирається в JS
            (прозорий ↔ line), а не дописується поверх: два класи кольору межі
            на одному вузлі вирішував би порядок у CSS.
          -->
          <div
            v-if="hasHeader"
            class="flex shrink-0 items-center justify-between gap-3 border-b py-3 pr-3 pl-4 transition-[border-color] sm:pl-5"
            :class="[scrolledFromTop ? 'border-line' : 'border-transparent', showDragHandle ? 'touch-none sm:touch-auto' : '']"
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
              Хрестик — велике кругле тло без рамки (як кнопки вікна в GNOME):
              легка підкладка кольору `ink` під 10% альфи читається в обох
              темах без `dark:`, а без рамки хрестик не сперечається з назвою.
              Квадрат у рамці на тлі шапки виглядав окремою дрібною коробкою.

              Точність дотику тримає невидима зона 45×45 через
              `pointer-coarse:after:` — той самий патерн, що в UiButton і
              UiSwitch (W3C 2.5.8 Target Size). `relative` тут не декор: без
              нього `::after` рахував би зміщення від шапки, а не від кнопки.
              Розмітка однакова з UiDrawer.
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
            class="flex shrink-0 flex-wrap justify-end gap-3 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[border-color] sm:px-5 sm:pb-5 [&>*]:justify-center sm:[&>*]:min-w-28 max-sm:[&>*]:flex-1"
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
 * Анімація ОДНІЄЮ <Transition> на корені, а не вкладеними.
 *
 * У вихідному коді внутрішній <Transition name="fade"> обгортав панель БЕЗ
 * v-if, тож не спрацьовував ніколи, а половина стилів була мертвим кодом:
 * реально було видно лише opacity-фейд усього блоку.
 *
 * Тривалість задана явно через :duration у шаблоні, бо самі transition-и
 * висять на ДІТЯХ — з кореневого елемента Vue вивести її не може.
 */

/* Появу веде --duration-slow, вихід коротший — --duration-base: ті самі
   ролі, що в tokens.css і в transitionDuration у скрипті. */
.ui-modal-enter-active .ui-modal-backdrop {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.ui-modal-leave-active .ui-modal-backdrop {
  transition: opacity var(--duration-base) var(--ease-in);
}

.ui-modal-enter-from .ui-modal-backdrop,
.ui-modal-leave-to .ui-modal-backdrop {
  opacity: 0;
}

.ui-modal-enter-active .ui-modal-panel {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-emphasized);
}

.ui-modal-leave-active .ui-modal-panel {
  transition:
    opacity var(--duration-base) var(--ease-in),
    transform var(--duration-base) var(--ease-emphasized);
}

/* Мобільні: панель — bottom sheet, тож виїжджає знизу. */
.ui-modal-enter-from .ui-modal-panel,
.ui-modal-leave-to .ui-modal-panel {
  opacity: 0;
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .ui-modal-enter-from .ui-modal-panel,
  .ui-modal-leave-to .ui-modal-panel {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-modal-enter-active .ui-modal-backdrop,
  .ui-modal-leave-active .ui-modal-backdrop,
  .ui-modal-enter-active .ui-modal-panel,
  .ui-modal-leave-active .ui-modal-panel {
    transition-duration: 1ms;
  }

  .ui-modal-enter-from .ui-modal-panel,
  .ui-modal-leave-to .ui-modal-panel {
    transform: none;
  }
}
</style>
