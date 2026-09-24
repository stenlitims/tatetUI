<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import UiSpinner from './UiSpinner.vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useOverlayLayer } from '~/composables/useOverlayStack'
import { readDurationToken, useReducedMotion } from '~/composables/useReducedMotion'
import { useScrollLock } from '~/composables/useScrollLock'
import { dragAxis, rubberBandDelta, shouldAdvance, swipeDirection } from '~/utils/carousel'
import { lightboxIndex, zoomScroll } from '~/utils/lightbox'

export interface LightboxImage {
  /** Повнорозмірне зображення. */
  src: string
  /** Текстова альтернатива. Для скрінрідера це і є зображення. */
  alt: string
  /** Підпис під зображенням. */
  caption?: string
  /** Мініатюра для стрічки. Типово — `src`. */
  thumbnail?: string
}

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /**
     * Поточне зображення. Через `v-model:index`, але працює й без
     * прив'язки: гортання тоді живе всередині компонента.
     */
    index?: number
    /** Зображення галереї. */
    images: LightboxImage[]
    /** З останнього зображення переходити на перше. */
    loop?: boolean
    /** Стрічка мініатюр унизу. Сама ховається, коли зображення одне. */
    thumbnails?: boolean
    /**
     * Збільшення: клік по зображенню, `+`/`−` на клавіатурі. Збільшене
     * зображення рухається перетягуванням мишею, пальцем або стрілками.
     */
    zoomable?: boolean
    /** Доступна назва діалогу. */
    ariaLabel?: string
  }>(),
  {
    modelValue: false,
    index: 0,
    loop: false,
    thumbnails: true,
    zoomable: true,
    ariaLabel: 'Перегляд зображень',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:index': [value: number]
  close: []
}>()

defineSlots<{
  /** Додаткові дії у верхній панелі: «Завантажити», «Поділитися». */
  actions?: (props: { image: LightboxImage; index: number }) => unknown
  /** Власний підпис замість `caption` зображення. */
  caption?: (props: { image: LightboxImage; index: number }) => unknown
}>()

const count = computed(() => props.images.length)

/*
 * Індекс — локальний стан, синхронізований із props, а не чисте
 * відображення props.index. Інакше галерея без `v-model:index` не гортала
 * б узагалі: подія йшла б у нікуди, а props лишався б нулем.
 */
const current = ref(lightboxIndex(props.index, count.value))
watch(
  () => props.index,
  (value) => {
    current.value = lightboxIndex(value, count.value)
  },
)
watch(count, (total) => {
  current.value = lightboxIndex(current.value, total)
})

const image = computed<LightboxImage | undefined>(() => props.images[current.value])
const atStart = computed(() => !props.loop && current.value === 0)
const atEnd = computed(() => !props.loop && current.value === count.value - 1)

function goTo(target: number) {
  if (!count.value) return
  const next = lightboxIndex(target, count.value, props.loop)
  if (next === current.value) return
  current.value = next
  emit('update:index', next)
}

function previous() {
  if (count.value > 1 && !atStart.value) goTo(current.value - 1)
}

function next() {
  if (count.value > 1 && !atEnd.value) goTo(current.value + 1)
}

/* ------------------------------------------------------------------ */
/*  Завантаження зображення                                            */
/* ------------------------------------------------------------------ */

const imageEl = shallowRef<HTMLImageElement | null>(null)
const loaded = shallowRef(false)
const failed = shallowRef(false)

watch(
  () => image.value?.src,
  () => {
    loaded.value = false
    failed.value = false
    zoomOut()
  },
)

// Зображення з кешу вже `complete` на момент монтування — події load не
// буде, і без цієї перевірки спінер крутився б над готовою картинкою.
function setImageEl(element: unknown) {
  imageEl.value = element instanceof HTMLImageElement ? element : null
  if (imageEl.value?.complete && imageEl.value.naturalWidth > 0) loaded.value = true
}

/*
 * Сусідні зображення вантажимо наперед: гортання галереї — послідовне, і
 * наступне фото має бути готовим до того, як його попросили.
 */
watch([current, () => props.modelValue], () => {
  if (!props.modelValue || typeof Image === 'undefined' || count.value < 2) return
  for (const offset of [1, -1]) {
    const neighbour = props.images[lightboxIndex(current.value + offset, count.value, true)]
    if (neighbour) new Image().src = neighbour.src
  }
})

/* ------------------------------------------------------------------ */
/*  Збільшення                                                         */
/* ------------------------------------------------------------------ */

const stageEl = ref<HTMLElement | null>(null)
const zoomSize = shallowRef<{ width: number; height: number } | null>(null)
const zoomed = computed(() => zoomSize.value !== null)
const canZoom = computed(() => props.zoomable && loaded.value && !failed.value)

/*
 * Збільшення до точки кліку: після збільшення під курсором лишається та
 * сама деталь, а не лівий верхній кут. Масштаб — щонайменше 2×, але до
 * натурального розміру, якщо фото більше, і не більше 4×.
 */
async function zoomAt(clientX?: number, clientY?: number) {
  const img = imageEl.value
  const stage = stageEl.value
  if (!img || !stage || !canZoom.value) return
  const rect = img.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const scale = Math.min(Math.max(2, img.naturalWidth / rect.width), 4)
  const pointX = clientX ?? rect.left + rect.width / 2
  const pointY = clientY ?? rect.top + rect.height / 2

  zoomSize.value = { width: rect.width * scale, height: rect.height * scale }
  await nextTick()

  const stageRect = stage.getBoundingClientRect()
  const scroll = zoomScroll({
    fractionX: (pointX - rect.left) / rect.width,
    fractionY: (pointY - rect.top) / rect.height,
    zoomedWidth: zoomSize.value.width,
    zoomedHeight: zoomSize.value.height,
    offsetLeft: img.offsetLeft,
    offsetTop: img.offsetTop,
    pointerX: pointX - stageRect.left,
    pointerY: pointY - stageRect.top,
  })
  stage.scrollLeft = scroll.left
  stage.scrollTop = scroll.top
}

function zoomOut() {
  zoomSize.value = null
}

function toggleZoom() {
  if (zoomed.value) zoomOut()
  else void zoomAt()
}

/* ------------------------------------------------------------------ */
/*  Жести                                                              */
/* ------------------------------------------------------------------ */

const dragOffset = shallowRef(0)
const dragging = shallowRef(false)
let pointerId: number | null = null
let startX = 0
let startY = 0
let startStamp = 0
let startScrollLeft = 0
let startScrollTop = 0
let stageWidth = 0
let axis: 'x' | 'y' | null = null
// Жест, що рушив зображення, не має закінчитись ще й кліком по ньому —
// інакше кожне перетягування вмикало б збільшення.
let swallowClick = false

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (pointerId !== null) return
  pointerId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  startStamp = event.timeStamp
  startScrollLeft = stageEl.value?.scrollLeft ?? 0
  startScrollTop = stageEl.value?.scrollTop ?? 0
  stageWidth = stageEl.value?.clientWidth ?? 0
  axis = null
  swallowClick = false
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (Math.abs(dx) + Math.abs(dy) > 4) swallowClick = true

  if (zoomed.value) {
    // Пальцем збільшене зображення рухає нативна прокрутка; мишею — ми.
    if (event.pointerType !== 'mouse' || !stageEl.value) return
    stageEl.value.scrollLeft = startScrollLeft - dx
    stageEl.value.scrollTop = startScrollTop - dy
    return
  }

  if (axis === null) {
    axis = dragAxis(dx, dy)
    if (axis !== 'x') return
    dragging.value = true
    try {
      stageEl.value?.setPointerCapture(event.pointerId)
    } catch {
      // Вказівник уже пішов — жест завершиться на pointerup/cancel.
    }
  }
  if (axis !== 'x' || count.value < 2) return
  dragOffset.value = rubberBandDelta(dx, { atStart: atStart.value, atEnd: atEnd.value })
}

function resetGesture() {
  pointerId = null
  axis = null
  dragging.value = false
  dragOffset.value = 0
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  if (!zoomed.value && axis === 'x' && count.value > 1) {
    const dx = event.clientX - startX
    if (shouldAdvance({ dx, elapsedMs: event.timeStamp - startStamp, width: stageWidth })) {
      if (swipeDirection(dx) === 'next') next()
      else previous()
    }
  }
  resetGesture()
}

function onStageClick(event: MouseEvent) {
  if (swallowClick) {
    swallowClick = false
    return
  }
  if (event.target === imageEl.value) {
    if (!props.zoomable) return
    if (zoomed.value) zoomOut()
    else void zoomAt(event.clientX, event.clientY)
    return
  }
  // Клік у порожнє поле навколо зображення — як клік по фону модалки.
  if (event.target === stageEl.value && !zoomed.value) close()
}

/* ------------------------------------------------------------------ */
/*  Відкриття, фокус, клавіатура                                       */
/* ------------------------------------------------------------------ */

const panelEl = ref<HTMLElement | null>(null)
const thumbEls = shallowRef<(HTMLElement | null)[]>([])
const teleportReady = shallowRef(false)
/*
 * Escape — через спільний реєстр шарів, як у Modal і Drawer: він віддає
 * натиск рівно верхньому шару, тож підказка чи меню, відкриті поверх
 * галереї, закриються першими, а галерея — лише наступним Escape.
 */
const layer = useOverlayLayer(undefined, {
  // Перший Escape лише зменшує: «вийти зі збільшення» і «закрити галерею» —
  // різні наміри, і другий не має ховатися за першим.
  onEscape: () => (zoomed.value ? zoomOut() : close()),
})
const scrollLock = useScrollLock()
const focusTrap = useFocusTrap(() => panelEl.value)
const reducedMotion = useReducedMotion()
const titleId = `${useId()}-lightbox`

// Тривалості — з токенів руху, а не літерали: проєкт, що перевизначив
// --duration-slow, інакше отримав би обрізану анімацію.
const transitionDuration = computed(() =>
  reducedMotion.value
    ? 0
    : { enter: readDurationToken('--duration-slow', 260), leave: readDurationToken('--duration-base', 180) },
)

function close() {
  emit('update:modelValue', false)
  emit('close')
}

async function handleOpen() {
  layer.activate()
  scrollLock.lock()
  await nextTick()
  // Фокус на саму панель, а не на хрестик: стрілки мають гортати одразу,
  // а перший Tab — дійти до першої кнопки, не пропустивши її.
  focusTrap.activate({ initialFocus: null })
  scrollThumbIntoView(false)
}

function handleClose() {
  focusTrap.deactivate()
  scrollLock.unlock()
  layer.deactivate()
  zoomOut()
  resetGesture()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void handleOpen()
    else handleClose()
  },
)

function scrollThumbIntoView(smooth = true) {
  void nextTick(() => {
    thumbEls.value[current.value]?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: smooth && !reducedMotion.value ? 'smooth' : 'auto',
    })
  })
}

watch(current, () => {
  if (props.modelValue) scrollThumbIntoView()
})

const PAN_STEP = 80

function onKeydown(event: KeyboardEvent) {
  // defaultPrevented — натиск уже обробив шар вище (меню, поле в панелі дій).
  if (event.defaultPrevented || !props.modelValue || !layer.isTopmost.value) return
  // Ціль — не обов'язково Element (подію можна диспатчити і на document).
  const target = event.target
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return

  const stage = stageEl.value
  switch (event.key) {
    case 'ArrowLeft':
      if (zoomed.value) stage?.scrollBy({ left: -PAN_STEP })
      else previous()
      break
    case 'ArrowRight':
      if (zoomed.value) stage?.scrollBy({ left: PAN_STEP })
      else next()
      break
    case 'ArrowUp':
    case 'ArrowDown':
      if (!zoomed.value) return
      stage?.scrollBy({ top: event.key === 'ArrowUp' ? -PAN_STEP : PAN_STEP })
      break
    case 'Home':
      if (zoomed.value) return
      goTo(0)
      break
    case 'End':
      if (zoomed.value) return
      goTo(count.value - 1)
      break
    case '+':
    case '=':
      if (zoomed.value) return
      void zoomAt()
      break
    case '-':
    case '0':
      if (!zoomed.value) return
      zoomOut()
      break
    default:
      return
  }
  event.preventDefault()
  event.stopPropagation()
}

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('keydown', onKeydown)
  if (props.modelValue) void handleOpen()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  handleClose()
})

const announcement = computed(() =>
  image.value ? `Зображення ${current.value + 1} з ${count.value}: ${image.value.alt}` : '',
)

const imageStyle = computed(() => {
  if (zoomSize.value) {
    return {
      width: `${zoomSize.value.width}px`,
      height: `${zoomSize.value.height}px`,
      maxWidth: 'none',
      maxHeight: 'none',
    }
  }
  return dragOffset.value ? { transform: `translateX(${dragOffset.value}px)` } : undefined
})

/*
 * Кнопки поверх фото — кола з поверхнею картки й blur, як стрілки
 * UiCarousel: читаються на будь-якому зображенні й у будь-якій темі.
 * Позиція й display — окремо на кожному місці: `relative`/`absolute` чи
 * `flex`/`hidden` в одному рядку класів вирішував би порядок CSS, а не
 * шаблон.
 */
const chromeButton =
  'h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card/85 text-ink shadow-card backdrop-blur-sm transition-colors hover:bg-card active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9 ' +
  "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"

defineExpose({ previous, next, goTo, zoomIn: () => zoomAt(), zoomOut })
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <Transition name="ui-lightbox" :duration="transitionDuration" @after-leave="layer.settle()">
      <div
        v-if="modelValue"
        data-ui-overlay
        class="fixed inset-0"
        :style="{ zIndex: layer.zIndex.value }"
      >
        <!-- Фон — майже чорний в обох темах: фото читається на темному, а
             кнопки й підписи несуть власну поверхню картки. -->
        <div class="ui-lightbox-backdrop absolute inset-0 bg-backdrop/90" aria-hidden="true" />

        <div
          ref="panelEl"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel"
          :aria-describedby="image ? titleId : undefined"
          tabindex="-1"
          class="ui-lightbox-panel relative flex h-full flex-col outline-none"
        >
          <span :id="titleId" class="sr-only" aria-live="polite">{{ announcement }}</span>

          <div class="flex shrink-0 items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
            <span
              v-if="count > 1"
              class="rounded-full border border-line bg-card/85 px-3 py-1.5 text-sm font-medium tabular-nums text-ink shadow-card backdrop-blur-sm"
              aria-hidden="true"
            >
              {{ current + 1 }} / {{ count }}
            </span>
            <span v-else />

            <div class="flex items-center gap-2">
              <slot v-if="image" name="actions" :image="image" :index="current" />
              <button
                v-if="zoomable"
                type="button"
                class="relative flex"
                :class="chromeButton"
                :disabled="!canZoom"
                :aria-label="zoomed ? 'Зменшити' : 'Збільшити'"
                :aria-pressed="zoomed"
                @click="toggleZoom"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-4.2-4.2M8.5 11h5" />
                  <path v-if="!zoomed" d="M11 8.5v5" />
                </svg>
              </button>
              <button type="button" class="relative flex" :class="chromeButton" aria-label="Закрити" @click="close">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div class="relative min-h-0 flex-1">
            <!--
              Сцена — flex-контейнер із прокруткою, а зображення має m-auto.
              Так зображення відцентроване, поки вміщається, а збільшене
              прокручується від самого краю: звичайне центрування
              (justify-center) обрізало б ліву частину, до якої вже не
              докрутиш.
            -->
            <div
              ref="stageEl"
              class="scrollbar-none absolute inset-0 flex overflow-auto"
              :class="[
                zoomed ? 'touch-auto cursor-zoom-out' : 'touch-pan-y px-2 sm:px-16',
                dragging ? 'select-none' : '',
              ]"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="resetGesture"
              @click="onStageClick"
            >
              <img
                v-if="image"
                :key="image.src"
                :ref="setImageEl"
                :src="image.src"
                :alt="image.alt"
                draggable="false"
                decoding="async"
                class="m-auto block max-h-full max-w-full object-contain transition-opacity duration-(--duration-base)"
                :class="[
                  loaded ? 'opacity-100' : 'opacity-0',
                  dragging ? '' : 'ui-lightbox-snap',
                  zoomable && !zoomed ? 'cursor-zoom-in' : '',
                ]"
                :style="imageStyle"
                @load="loaded = true"
                @error="failed = true"
              />
            </div>

            <div
              v-if="image && !loaded && !failed"
              class="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span class="rounded-full border border-line bg-card/85 p-3 shadow-card backdrop-blur-sm">
                <UiSpinner size="lg" tone="accent" label="Завантаження зображення" />
              </span>
            </div>

            <div
              v-if="!image || failed"
              class="pointer-events-none absolute inset-0 flex items-center justify-center p-6"
            >
              <p class="rounded-card border border-line bg-card/90 px-4 py-3 text-sm text-ink shadow-card" role="alert">
                {{ image ? 'Не вдалося завантажити зображення' : 'Немає зображень' }}
              </p>
            </div>

            <!-- Стрілки лише від sm: на телефоні основний жест — свайп, а
                 кнопки поверх фото закривали б його край, як у UiCarousel. -->
            <template v-if="count > 1 && !zoomed">
              <button
                type="button"
                :class="chromeButton"
                class="absolute left-3 top-1/2 hidden -translate-y-1/2 sm:flex"
                :disabled="atStart"
                aria-label="Попереднє зображення"
                @click="previous"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                :class="chromeButton"
                class="absolute right-3 top-1/2 hidden -translate-y-1/2 sm:flex"
                :disabled="atEnd"
                aria-label="Наступне зображення"
                @click="next"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </template>
          </div>

          <div
            v-if="image && ($slots.caption || image.caption)"
            class="flex shrink-0 justify-center px-4 pt-3"
          >
            <div class="max-w-2xl rounded-card border border-line bg-card/85 px-3 py-2 text-center text-sm text-ink shadow-card backdrop-blur-sm">
              <slot name="caption" :image="image" :index="current">{{ image.caption }}</slot>
            </div>
          </div>

          <!--
            Стрічка мініатюр: w-fit + mx-auto, а не justify-center на
            контейнері з прокруткою — інакше при переповненні ліві мініатюри
            опиняються за лівим краєм, куди прокрутка вже не дістає.
          -->
          <div
            v-if="thumbnails && count > 1"
            class="shrink-0 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4"
          >
            <div class="scrollbar-none mx-auto flex w-fit max-w-full gap-2 overflow-x-auto px-4 py-1" role="group" aria-label="Мініатюри">
              <button
                v-for="(item, index) in images"
                :key="`${item.src}-${index}`"
                :ref="(el) => (thumbEls[index] = el as HTMLElement | null)"
                type="button"
                class="relative h-14 w-14 shrink-0 overflow-hidden rounded-control border-2 bg-card transition-[border-color,opacity] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-backdrop"
                :class="index === current ? 'border-accent-solid opacity-100' : 'border-transparent opacity-60 hover:opacity-100'"
                :aria-label="`Зображення ${index + 1}: ${item.alt}`"
                :aria-current="index === current ? 'true' : undefined"
                @click="goTo(index)"
              >
                <img :src="item.thumbnail ?? item.src" alt="" loading="lazy" decoding="async" class="h-full w-full object-cover" />
              </button>
            </div>
          </div>
          <div v-else class="shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
 * Після відпускання жесту зображення повертається на місце плавно, а під
 * пальцем — рухається без затримки (клас знімається на час перетягування).
 */
.ui-lightbox-snap {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-slow) var(--ease-emphasized);
}

.ui-lightbox-enter-active .ui-lightbox-backdrop,
.ui-lightbox-leave-active .ui-lightbox-backdrop {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.ui-lightbox-enter-from .ui-lightbox-backdrop,
.ui-lightbox-leave-to .ui-lightbox-backdrop {
  opacity: 0;
}

.ui-lightbox-enter-active .ui-lightbox-panel {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-emphasized);
}

.ui-lightbox-leave-active .ui-lightbox-panel {
  transition:
    opacity var(--duration-base) var(--ease-in),
    transform var(--duration-base) var(--ease-in);
}

.ui-lightbox-enter-from .ui-lightbox-panel,
.ui-lightbox-leave-to .ui-lightbox-panel {
  opacity: 0;
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .ui-lightbox-enter-from .ui-lightbox-panel,
  .ui-lightbox-leave-to .ui-lightbox-panel {
    transform: none;
  }
}
</style>
