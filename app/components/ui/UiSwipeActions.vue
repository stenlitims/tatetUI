<script lang="ts">
import { reactive } from 'vue'

/**
 * Відкритий рядок кожної групи — спільний для всіх екземплярів: відкриття
 * рядка закриває попередній у тій самій групі.
 */
const openSwipeRows = reactive(new Map<string, string>())
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { bindSwipe, rubberBand } from '~/utils/swipe'

const props = withDefaults(
  defineProps<{
    /**
     * Дії під рядком у порядку зліва направо. Свайп ліворуч відкриває їх
     * біля правого краю. `tone` — колір кнопки; `class` замінює його цілком
     * (власні токени проєкту), а не дописується поверх.
     */
    actions: { key: string; label: string; tone?: 'accent' | 'danger' | 'neutral'; class?: string }[]
    /** Ширина однієї дії, px. Типово — квадрат на висоту рядка списку. */
    actionWidth?: number
    /** Вимкнути жест (наприклад, поки відкрите контекстне меню рядка). */
    disabled?: boolean
    /**
     * Група рядків: відкритим одночасно може бути лише один рядок групи —
     * відкриття наступного закриває попередній.
     */
    group?: string
    /**
     * Тло рухомого шару. Має бути непрозорим, інакше дії просвічують крізь
     * рядок; задайте те саме тло, що в списку.
     */
    surfaceClass?: string
  }>(),
  { actionWidth: 72, disabled: false, group: 'default', surfaceClass: 'bg-card' },
)

const emit = defineEmits<{
  action: [key: string]
}>()

type Action = (typeof props.actions)[number]
type Tone = NonNullable<Action['tone']>

defineSlots<{
  /** Рядок, що їде за пальцем. */
  default?: () => unknown
  /** Іконка над підписом дії: `action` — сама дія з `actions`. */
  icon?: (props: { action: Action }) => unknown
}>()

/*
 * Кольори — пари заливки й тексту з токенів: білий підпис на акценті й
 * небезпеці, нейтральна сіра — з ink. Власна пара проєкту приходить через
 * `class` і замінює тон, щоб на кнопці не опинилося двох bg-*.
 */
const TONES: Record<Tone, string> = {
  accent: 'bg-accent-solid text-accent-contrast',
  danger: 'bg-danger-solid text-danger-contrast',
  neutral: 'bg-line-strong text-ink',
}
const actionClass = (action: Action) => action.class ?? TONES[action.tone ?? 'neutral']

const rowId = useId()
const rootEl = ref<HTMLElement | null>(null)
/** Зсув рядка, px (≤ 0); дії видно під ним. */
const offset = ref(0)
const dragging = ref(false)
/** Рядок доїжджає на місце після відпускання: дії ще видно під ним. */
const animating = ref(false)
let base = 0
let animTimer: ReturnType<typeof setTimeout> | null = null

const actionsWidth = computed(() => props.actions.length * props.actionWidth)
const visible = computed(() => offset.value < 0 || dragging.value || animating.value)
const surfaceStyle = computed(() => {
  if (!visible.value) return undefined
  return {
    transform: `translateX(${offset.value}px)`,
    transition: dragging.value ? 'none' : 'transform var(--duration-base) var(--ease-out)',
  }
})

function moveTo(x: number) {
  offset.value = x
  animating.value = true
  if (animTimer) clearTimeout(animTimer)
  animTimer = setTimeout(() => (animating.value = false), 240)
}

function close() {
  if (offset.value) moveTo(0)
  if (openSwipeRows.get(props.group) === rowId) openSwipeRows.delete(props.group)
}

function settle(open: boolean) {
  dragging.value = false
  if (!open) return close()
  moveTo(-actionsWidth.value)
  openSwipeRows.set(props.group, rowId)
}

// Відкрили інший рядок групи — цей закривається.
watch(
  () => openSwipeRows.get(props.group),
  (id) => {
    if (id !== rowId && offset.value) moveTo(0)
  },
)

// Відкриті дії закриває дотик повз них і будь-яка прокрутка.
function onOutside(event: Event) {
  if (event.type === 'pointerdown' && rootEl.value?.contains(event.target as Node)) return
  close()
}
watch(
  () => offset.value < 0 && !dragging.value,
  (open) => {
    if (typeof document === 'undefined') return
    const method = open ? 'addEventListener' : 'removeEventListener'
    document[method]('pointerdown', onOutside, true)
    document[method]('scroll', onOutside, true)
  },
)

function run(action: Action) {
  close()
  emit('action', action.key)
}

/** Дотик по відкритому рядку закриває дії, а не активує рядок. */
function onClickCapture(event: MouseEvent) {
  if (!offset.value || (event.target as Element | null)?.closest('[data-swipe-actions]')) return
  event.preventDefault()
  event.stopPropagation()
  close()
}

const unbind: (() => void)[] = []
onMounted(() => {
  const el = rootEl.value
  if (!el) return
  unbind.push(
    bindSwipe(el, {
      direction: 'left',
      canStart: () => !props.disabled && props.actions.length > 0,
      onStart: () => {
        base = offset.value
        dragging.value = true
        openSwipeRows.set(props.group, rowId)
      },
      onMove: (dx) => (offset.value = Math.min(0, rubberBand(base + dx, actionsWidth.value))),
      onEnd: ({ velocity, cancelled }) => settle(!cancelled && (velocity < -0.3 || offset.value < -actionsWidth.value / 2)),
    }),
    // Свайп праворуч закриває відкриті дії.
    bindSwipe(el, {
      direction: 'right',
      canStart: () => offset.value < 0,
      onStart: () => {
        base = offset.value
        dragging.value = true
      },
      onMove: (dx) => (offset.value = Math.min(0, base + dx)),
      onEnd: ({ velocity, cancelled }) => settle(cancelled || (velocity < 0.3 && offset.value < -actionsWidth.value / 2)),
    }),
  )
})

onBeforeUnmount(() => {
  unbind.forEach((off) => off())
  if (animTimer) clearTimeout(animTimer)
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', onOutside, true)
    document.removeEventListener('scroll', onOutside, true)
  }
  if (openSwipeRows.get(props.group) === rowId) openSwipeRows.delete(props.group)
})
</script>

<template>
  <!-- touch-pan-y: горизонтальний рух — жест рядка, вертикальний — прокрутка списку. -->
  <div ref="rootEl" class="relative touch-pan-y touch-pinch-zoom overflow-clip" @click.capture="onClickCapture">
    <!-- Дії рендеряться лише поки рядок зсунуто: у довгому списку не множимо кнопки. -->
    <div v-if="visible" data-swipe-actions class="absolute inset-y-0 right-0 flex" :style="{ width: `${actionsWidth}px` }">
      <button
        v-for="action in actions"
        :key="action.key"
        type="button"
        class="flex flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition-[filter] active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        :class="actionClass(action)"
        @click="run(action)"
      >
        <slot name="icon" :action="action" />
        <span class="max-w-full truncate">{{ action.label }}</span>
      </button>
    </div>
    <div class="relative" :class="surfaceClass" :style="surfaceStyle">
      <slot />
    </div>
  </div>
</template>
