<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'
import {
  dragAxis,
  dragThreshold,
  rubberBandDelta,
  shouldAdvance,
  swipeDirection,
} from '~/utils/carousel'

const props = withDefaults(
  defineProps<{
    /** Слайди. Рендер кожного — слот `slide`. */
    items: T[]
    /** Індекс поточного слайда. Використовуйте через `v-model`. */
    modelValue?: number
    /** З останнього слайда переходити на перший. */
    loop?: boolean
    /**
     * Автоматичне гортання. Вимикається саме собою при
     * `prefers-reduced-motion`, на час наведення чи фокуса і доки
     * вкладка у фоні.
     */
    autoplay?: boolean
    /** Пауза між автоматичними переходами, мс. */
    interval?: number
    /** Спинати автогортання під курсором. */
    pauseOnHover?: boolean
    /**
     * Перетягування слайда пальцем або мишею. Вимикайте, коли всередині
     * слайда є текст для виділення або поля вводу.
     */
    draggable?: boolean
    /** Доступна назва каруселі. */
    ariaLabel?: string
  }>(),
  {
    modelValue: 0,
    loop: false,
    autoplay: false,
    interval: 5000,
    pauseOnHover: true,
    draggable: true,
    ariaLabel: 'Карусель',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()

defineSlots<{
  slide: (props: { item: T; index: number; active: boolean }) => unknown
  previous?: (props: { disabled: boolean }) => unknown
  next?: (props: { disabled: boolean }) => unknown
}>()

const reducedMotion = useReducedMotion()
const trackEl = ref<HTMLElement | null>(null)
const hovering = shallowRef(false)
const focused = shallowRef(false)
const autoplayPaused = shallowRef(false)
const documentPaused = shallowRef(false)
const dragging = shallowRef(false)
const dragOffset = shallowRef(0)
let timer: number | null = null

/*
 * Стан активного жесту. Реактивні тут лише ті величини, що впливають на
 * рендер (dragOffset, dragging); raw-поля — навпаки: зайвий ререндер від
 * змінення pointerId чи часової мітки нікому не потрібен.
 */
let activePointerId: number | null = null
let startX = 0
let startY = 0
let startStamp = 0
let trackWidth = 0
/** 'x' — ведемо слайд, 'y' — жест віддали скролу сторінки, null — не вирішено. */
let axis: 'x' | 'y' | null = null
// Відстань останнього завершеного перетягування: клік одразу після неї —
// продовження жесту, а не навігація. NaN — «проковтнути наступний клік
// безумовно» (вертикальний скрол теж може синтезувати клік).
let lastDragDistance = 0

const count = computed(() => props.items.length)
const current = computed(() => count.value ? Math.max(0, Math.min(count.value - 1, Math.floor(props.modelValue))) : 0)
const previousDisabled = computed(() => count.value < 2 || (!props.loop && current.value === 0))
const nextDisabled = computed(() => count.value < 2 || (!props.loop && current.value === count.value - 1))
const shouldAutoplay = computed(() =>
  props.autoplay
  && !autoplayPaused.value
  && !documentPaused.value
  && !reducedMotion.value
  && count.value > 1
  && !(props.pauseOnHover && hovering.value)
  && !focused.value,
)

// Поріг свайпу від ширини треку + флік: «недотягнуті» змахи на телефоні —
// найпоширеніша скарга на каруселі з фіксованим порогом у пікселях.

const trackStyle = computed(() => ({
  transform: `translate3d(calc(${-current.value * 100}% + ${dragOffset.value}px), 0, 0)`,
}))

function goTo(index: number) {
  if (!count.value) return
  let next = index
  if (props.loop) next = (index + count.value) % count.value
  else next = Math.max(0, Math.min(count.value - 1, index))
  if (next === current.value) return
  emit('update:modelValue', next)
  emit('change', next)
}

function previous() {
  if (!previousDisabled.value) goTo(current.value - 1)
}

function next() {
  if (!nextDisabled.value) goTo(current.value + 1)
}

function clearTimer() {
  if (timer === null) return
  window.clearInterval(timer)
  timer = null
}

function syncTimer() {
  clearTimer()
  if (!shouldAutoplay.value || typeof window === 'undefined') return
  timer = window.setInterval(() => {
    if (!props.loop && current.value === count.value - 1) goTo(0)
    else goTo(current.value + 1)
  }, Math.max(1000, props.interval))
}

function toggleAutoplay() {
  autoplayPaused.value = !autoplayPaused.value
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') previous()
  else if (event.key === 'ArrowRight') next()
  else if (event.key === 'Home') goTo(0)
  else if (event.key === 'End') goTo(count.value - 1)
  else return
  event.preventDefault()
}

function onPointerDown(event: PointerEvent) {
  if (!props.draggable) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  // Другий палець не перезапускає жест: триває той, що почався першим.
  if (activePointerId !== null) return
  // Клік, синтезований попереднім скрол-жестом, міг не відбутися: прапорець
  // не сміє дожити до наступного справжнього кліку користувача.
  swallowNextClick = false
  activePointerId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  startStamp = event.timeStamp
  axis = null
  trackWidth = trackEl.value?.getBoundingClientRect().width ?? 0
}

/*
 * Осьове блокування: перші ~8px жест нічого не рухають — класифікуємо
 * домінантну вісь. Горизонталь — карусель веде слайд і захоплює вказівник
 * (setPointerCapture: палець, що з'їхав за межі компонента на 5px, більше
 * не обриває перетягування pointerleave'ом). Вертикаль — жест цілком
 * віддаємо скролу сторінки.
 */
function onPointerMove(event: PointerEvent) {
  if (activePointerId === null || event.pointerId !== activePointerId) return

  if (axis === null) {
    const judged = dragAxis(event.clientX - startX, event.clientY - startY)
    if (judged === null) return
    axis = judged
    if (axis === 'y') {
      lastDragDistance = Number.NaN // скрол теж може синтезувати клік
      return
    }
    dragging.value = true
    // Вказівник іде за пальцем навіть поза компонентом: без capture палець,
    // що з'їхав на 5px убік, обривав перетягування pointerleave'ом і трек
    // різко смикався назад.
    const section = event.currentTarget as HTMLElement | null
    try {
      section?.setPointerCapture(event.pointerId)
    } catch {
      // Вказівник уже пішов — жест завершиться на pointerup/cancel природно.
    }
  }

  const delta = rubberBandDelta(event.clientX - startX, {
    atStart: !props.loop && current.value === 0,
    atEnd: !props.loop && current.value === count.value - 1,
  })
  dragOffset.value = delta
}

function endDrag(event: PointerEvent) {
  if (activePointerId === null || event.pointerId !== activePointerId) return
  const wasHorizontal = axis === 'x'
  const dx = event.clientX - startX
  const elapsed = event.timeStamp - startStamp
  activePointerId = null
  axis = null
  dragging.value = false
  dragOffset.value = 0

  if (!wasHorizontal) {
    // Вертикальний жест або рух менший за поріг класифікації — це не свайп:
    // клік після нього має залишитися кліком. Гасимо його лише тоді, коли
    // вертикальний скрол упевнено почався (він синтезує click сам).
    if (Number.isNaN(lastDragDistance)) {
      lastDragDistance = 0
      swallowNextClick = true
    }
    return
  }

  lastDragDistance = Math.abs(dx) >= 8 ? dx : 0
  if (shouldAdvance({ dx, elapsedMs: elapsed, width: trackWidth })) {
    swipeDirection(dx) === 'previous' ? previous() : next()
  }
}

function cancelDrag(event: PointerEvent) {
  if (activePointerId === null || event.pointerId !== activePointerId) return
  activePointerId = null
  axis = null
  dragging.value = false
  dragOffset.value = 0
  lastDragDistance = 0
}

let swallowNextClick = false

/*
 * Клік одразу після перетягування — це закінчення жесту, а не вибір того,
 * що було під пальцем на момент відпускання. Без цього drag на 200px,
 * відпущений над посиланням усередині слайда, відкривав би його.
 */
function onClickCapture(event: MouseEvent) {
  if (swallowNextClick) {
    swallowNextClick = false
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if (Math.abs(lastDragDistance) < 8) return
  lastDragDistance = 0
  event.preventDefault()
  event.stopPropagation()
}

function onVisibilityChange() {
  // Вкладка у фоні — таймер усе одно тікає в більшості браузерів, тож
  // користувач повертався б на слайд, що сам застрибнув у бік. Пауза
  // без «залишити на паузі назавжди»: повернення відновлює автопрокрутку.
  documentPaused.value = document.hidden
}

watch([shouldAutoplay, () => props.interval], syncTimer)
watch([count, () => props.modelValue], () => {
  if (props.modelValue !== current.value) emit('update:modelValue', current.value)
}, { immediate: true })

onMounted(() => {
  syncTimer()
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onBeforeUnmount(() => {
  clearTimer()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

defineExpose({ previous, next, goTo, pause: () => { autoplayPaused.value = true }, play: () => { autoplayPaused.value = false } })
</script>

<template>
  <section
    role="region"
    aria-roledescription="carousel"
    :aria-label="ariaLabel"
    class="relative outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
    tabindex="0"
    @keydown="onKeydown"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
    @focusin="focused = true"
    @focusout="focused = false"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointercancel="cancelDrag"
    @pointerleave="cancelDrag"
  >
    <!--
      touch-pan-y: горизонтальний рух забирає карусель, вертикальний
      залишається сторінці — разом з осьовим блокуванням у JS жест
      вирішується однаково і в браузері, і в компоненті.
    -->
    <div
      :aria-live="shouldAutoplay ? 'off' : 'polite'"
      class="relative isolate touch-pan-y overflow-hidden rounded-overlay"
      :class="dragging ? 'select-none' : ''"
      @click.capture="onClickCapture"
    >
      <div
        ref="trackEl"
        class="flex w-full will-change-transform transition-transform duration-300 ease-out motion-reduce:transition-none"
        :class="dragging ? 'transition-none' : ''"
        :style="trackStyle"
      >
        <div
          v-for="(item, index) in items"
          :key="index"
          class="w-full shrink-0"
          role="group"
          aria-roledescription="slide"
          :aria-label="`${index + 1} з ${count}`"
          :aria-hidden="index === current ? undefined : 'true'"
          :inert="index !== current"
        >
          <slot name="slide" :item="item" :index="index" :active="index === current" />
        </div>
      </div>

      <!-- На мобільному стрілок немає: свайп із фліком — основний жест, а
           кнопки поверх тексту лиш закривали слайд і конфліктували з
           пальцем. На десктопі — поверх слайда, на вертикальній середині:
           стандарт сучасних каруселей. Кола з напівпрозорим тлом і blur
           читаються на будь-якому наповненні слайда. -->
      <button
        v-if="count > 1"
        type="button"
        :disabled="previousDisabled"
        aria-label="Попередній слайд"
        class="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card/85 text-ink shadow-card backdrop-blur-sm transition-colors hover:bg-card active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:flex md:h-9 md:w-9"
        @click="previous"
      >
        <slot name="previous" :disabled="previousDisabled">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </slot>
      </button>

      <button
        v-if="count > 1"
        type="button"
        :disabled="nextDisabled"
        aria-label="Наступний слайд"
        class="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card/85 text-ink shadow-card backdrop-blur-sm transition-colors hover:bg-card active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:flex md:h-9 md:w-9"
        @click="next"
      >
        <slot name="next" :disabled="nextDisabled">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </slot>
      </button>
    </div>

    <div v-if="count > 1" class="mt-3 flex items-center justify-center gap-1" role="group" aria-label="Вибір слайда">
      <!--
        Індикатор-пігулка: активна розтягується, решта — точки. Видима
        мета 24×24, але на дотику невидима зона 44×44 через ::after
        (стиль нижче) — тим самим патерном, що UiSwitch.
      -->
      <button
        v-for="(_, index) in items"
        :key="index"
        type="button"
        class="ui-carousel-dot group relative flex h-6 w-6 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :aria-label="`Перейти до слайда ${index + 1}`"
        :aria-current="index === current ? 'true' : undefined"
        @click="goTo(index)"
      >
        <span
          class="block rounded-full transition-all duration-200"
          :class="index === current ? 'h-2 w-6 bg-accent-solid' : 'h-2 w-2 bg-line-strong group-hover:bg-accent'"
        />
      </button>

      <button
        v-if="autoplay"
        type="button"
        class="pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-12 relative ms-2 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :aria-label="autoplayPaused ? 'Продовжити автопрокрутку' : 'Призупинити автопрокрутку'"
        @click="toggleAutoplay"
      >
        <svg v-if="autoplayPaused" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
        <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5v14M15 5v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
/*
 * Невидима зона натискання 44×44 навколо індикатора.
 *
 * Видима мета — 24×24, бо індикатор стоїть у щільному ряду поруч з
 * сусідніми. Але пальцем у 24px не влучиш, а розтягувати видиму
 * пігулку означає зіпсувати ритм рядка — тож росте зона, не картинка.
 * Той самий патерн, що в UiSwitch.
 */
@media (hover: none) and (pointer: coarse) {
  .ui-carousel-dot::after {
    content: '';
    position: absolute;
    inset: 50% auto auto 50%;
    width: max(100%, 44px);
    height: max(100%, 44px);
    transform: translate(-50%, -50%);
  }
}
</style>