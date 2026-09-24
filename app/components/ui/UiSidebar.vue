<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useOverlayLayer } from '~/composables/useOverlayStack'
import { useReducedMotion } from '~/composables/useReducedMotion'
import { useScrollLock } from '~/composables/useScrollLock'
import { persistCollapsed, readStoredCollapsed } from '~/utils/uiSidebar'

const props = withDefaults(
  defineProps<{
    /**
     * Відкрито на мобільному. На десктопі панель видима завжди.
     * Використовуйте через `v-model`.
     */
    modelValue?: boolean
    /**
     * Згорнуто до вузької смуги з іконками. Лише десктоп. Використовуйте
     * через `v-model:collapsed`.
     */
    collapsed?: boolean
    /**
     * Ключ localStorage, під яким стан згортання живе між сесіями.
     * Читається в onMounted — як у UiResizablePanels, щоб не розійшлися
     * server і client рендери, — і записується при кожній зміні
     * `collapsed`: і з вбудованої кнопки, і з коду застосунку. Недоступне
     * сховище (private mode) мовчки пропускає персистентність.
     */
    storageKey?: string
    /** З якого боку екрана панель. */
    side?: 'left' | 'right'
    /** Ширина розгорнутої панелі, будь-яка CSS-величина. */
    width?: string
    /** Ширина згорнутої панелі, будь-яка CSS-величина. */
    collapsedWidth?: string
    /** Доступна назва панелі — вона є орієнтиром `navigation` на сторінці. */
    ariaLabel?: string
    /**
     * Показувати кнопку згортання. Вимкніть, якщо ширина панелі фіксована
     * дизайном.
     */
    collapsible?: boolean
    /**
     * CSS-селектор усередині панелі, якому віддати фокус при відкритті на
     * мобільному. Типово фокус отримує кнопка закриття, а без неї — сама
     * панель: автофокус в інпуті піднімає клавіатуру.
     */
    initialFocus?: string
    /**
     * Стабільний id шару в стеку оверлеїв. Задавати не обов'язково:
     * без нього генерується автоматично.
     */
    sidebarId?: string
  }>(),
  {
    modelValue: false,
    collapsed: false,
    storageKey: undefined,
    side: 'left',
    width: '17rem',
    collapsedWidth: '4.5rem',
    ariaLabel: 'Бічна навігація',
    collapsible: true,
    initialFocus: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:collapsed': [value: boolean]
  close: []
}>()

defineSlots<{
  header?: (props: { collapsed: boolean; close: () => void }) => unknown
  default?: (props: { collapsed: boolean; close: () => void }) => unknown
  footer?: (props: { collapsed: boolean; close: () => void }) => unknown
}>()

const panelEl = ref<HTMLElement | null>(null)
const closeBtnEl = ref<HTMLButtonElement | null>(null)
const isMobile = shallowRef(false)
const focusTrap = useFocusTrap(() => panelEl.value)
const scrollLock = useScrollLock()
const prefersReducedMotion = useReducedMotion()
/*
 * На мобільному це повноцінний модальний діалог — role="dialog",
 * aria-modal, пастка фокуса й лок прокрутки. Отже, і шар він мусить брати
 * зі спільного стеку, а не з літералів z-[990]/z-[1000], як було.
 *
 * Перший шар у стеку отримує рівно 1000, тож UiModal, відкритий ІЗ
 * сайдбару, зрівнювався з ним у z-index, і що опиниться зверху,
 * вирішував порядок вузлів у DOM. Саме цей клас багів useOverlayStack і
 * прибирає.
 */
const layer = useOverlayLayer(props.sidebarId)
const isOverlayMode = computed(() => isMobile.value)
let mobileQuery: MediaQueryList | null = null

/*
 * Відновлення стану згортання — без анімації ширини. Сховище читається
 * вже після гідрації, і серверна розгорнута панель інакше на кожному
 * завантаженні на очах «з'їжджала» в згорнуту, штовхаючи контент.
 */
const restoring = shallowRef(false)

// Блюр фону вимикається разом із анімаціями: той самий принцип, що й
// у UiModal/UiDrawer — reduce-рух вимикає і «дорогі» шари ефектів.
const backdropBlurClass = computed(() =>
  prefersReducedMotion.value ? '' : 'backdrop-blur-sm',
)

const sideClasses = computed(() => props.side === 'left'
  ? 'left-0 border-r md:border-r'
  : 'right-0 border-l md:border-l')
const mobileTransform = computed(() => {
  if (props.modelValue) return 'translate-x-0'
  return props.side === 'left' ? '-translate-x-full md:translate-x-0' : 'translate-x-full md:translate-x-0'
})
const panelStyle = computed(() => ({
  '--ui-sidebar-width': props.width,
  '--ui-sidebar-collapsed-width': props.collapsedWidth,
}))

/*
 * Невидима зона дотику 45×45 для кнопок шапки (пастка 11): видимі size-9
 * лишаються на десктопі, на coarse-вказівнику ціль дотику розширює ::after.
 * Живе рядком, як touchTargetClass в UiButton, — копіюється у споживачів.
 */
const touchTargetClass =
  'pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 ' +
  'pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 ' +
  "pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-12"

function close() {
  if (!props.modelValue) return
  emit('update:modelValue', false)
  emit('close')
}

function toggleCollapsed() {
  if (!props.collapsible) return
  emit('update:collapsed', !props.collapsed)
}

/* ---------------------------------------------------------------- */
/*  Збереження стану згортання між сесіями                          */
/* ---------------------------------------------------------------- */

/**
 * Сховище — утиліта `~/utils/uiSidebar` (правило дому: логіка поза
 * компонентом, щоб покривати тестами без рендеру). Тут лише зв'язка:
 * прочитати при монтуванні, записати при кожній зміні.
 *
 * Пишемо з watch на сам prop, а не з кнопки. Раніше зберігав лише
 * вбудований перемикач: згортання з коду застосунку (Ctrl+B, кнопка в
 * шапці) у сховище не потрапляло, і наступне завантаження повертало
 * старий стан поверх вибору користувача.
 */
watch(
  () => props.collapsed,
  (value) => {
    if (props.storageKey) persistCollapsed(props.storageKey, value)
  },
)

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // isTopmost — щоб Escape закривав сайдбар лише тоді, коли поверх нього
  // не відкрито модалку чи меню.
  if (!props.modelValue || !layer.isTopmost.value) return
  event.stopPropagation()
  close()
}

function syncMobile(event?: MediaQueryListEvent) {
  isMobile.value = event?.matches ?? mobileQuery?.matches ?? false
}

watch([() => props.modelValue, isMobile], async ([open, mobile]) => {
  if (open && mobile) {
    layer.activate()
    scrollLock.lock()
    await nextTick()
    // Фокус — на явну дію закриття, а не на контейнер: панель може бути
    // великою, і після неї Tab починався б із шапки, пропустивши все.
    // Явний initialFocus із пропса перемагає завжди.
    const initial = props.initialFocus
      ? (panelEl.value?.querySelector<HTMLElement>(props.initialFocus) ?? null)
      : closeBtnEl.value
    focusTrap.activate({ initialFocus: initial })
  } else {
    focusTrap.deactivate()
    scrollLock.unlock()
    layer.deactivate()
  }
}, { immediate: true })

onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    mobileQuery = window.matchMedia('(max-width: 767px)')
    syncMobile()
    mobileQuery.addEventListener('change', syncMobile)
  }

  // Збережений стан читається в onMounted, не в setup: у setup клієнт
  // відрендерився б інакше, ніж сервер (hydration mismatch). null —
  // ключа немає або сховище недоступне: стан лишається як задав споживач.
  if (props.storageKey) {
    const saved = readStoredCollapsed(props.storageKey)
    if (saved !== null && saved !== props.collapsed) {
      restoring.value = true
      emit('update:collapsed', saved)
      // Перший кадр малює нову ширину без transition, другий повертає анімацію.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        restoring.value = false
      }))
    }
  }

  // Escape на document, а не на панелі: фокус під час drag чи після кліку
  // по фону лишається в контенті, і «закрити з клавіатури» мало б працювати
  // незалежно від того, де саме фокус (той самий патерн, що в UiModal).
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  mobileQuery?.removeEventListener('change', syncMobile)
  focusTrap.deactivate()
  scrollLock.unlock()
  layer.deactivate()
  layer.settle()
})

defineExpose({ close, toggleCollapsed })
</script>

<template>
  <!-- Тривалість Transition виводить сам із токенів на backdrop — це його
       єдиний елемент. Явні 200 мс розходилися б із --duration-* токенами. -->
  <Transition
    enter-active-class="transition-opacity duration-(--duration-slow) ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-(--duration-base) ease-in"
    leave-to-class="opacity-0"
    @after-leave="layer.settle()"
  >
    <!-- Backdrop — не кнопка: фокусований aria-hidden елемент — це нарушение
         a11y. Клавіатурна альтернатива закриття — Escape, вона є завжди. -->
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-backdrop/50 md:hidden"
      :class="backdropBlurClass"
      :style="{ zIndex: layer.zIndex.value - 1 }"
      @click="close"
    />
  </Transition>

  <aside
    ref="panelEl"
    :aria-label="ariaLabel"
    :aria-modal="isMobile && modelValue ? 'true' : undefined"
    :aria-hidden="isMobile && !modelValue ? 'true' : undefined"
    :role="isMobile && modelValue ? 'dialog' : undefined"
    :inert="isMobile && !modelValue"
    :data-ui-overlay="isMobile && modelValue ? '' : undefined"
    tabindex="-1"
    :style="[panelStyle, isOverlayMode ? { zIndex: layer.zIndex.value } : {}]"
    class="fixed inset-y-0 flex h-[100dvh] w-[var(--ui-sidebar-width)] flex-col border-line bg-card text-ink shadow-overlay md:sticky md:top-0 md:z-auto md:h-screen md:shadow-none"
    :class="[
      sideClasses,
      mobileTransform,
      { 'md:w-[var(--ui-sidebar-collapsed-width)]': collapsed },
      restoring ? '' : 'transition-[width,transform] duration-(--duration-slow) ease-emphasized',
    ]"
  >
    <div class="flex min-h-14 items-center gap-2 border-b border-line px-3">
      <div class="min-w-0 flex-1">
        <slot name="header" :collapsed="collapsed" :close="close" />
      </div>
      <button
        v-if="collapsible"
        type="button"
        class="relative hidden size-9 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
        :class="touchTargetClass"
        :aria-label="collapsed ? 'Розгорнути бічну панель' : 'Згорнути бічну панель'"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >
        <!-- Шеврон вказує в бік, КУДИ панель згорнеться: ліва панель —
             ліворуч («), згорнута — праворуч (»). Для правої панелі —
             дзеркально. Клас літерал у гілці, інакше JIT його не згенерує. -->
        <svg
          class="h-4 w-4 transition-transform"
          :class="collapsed === (side === 'left') ? 'rotate-180' : ''"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        ref="closeBtnEl"
        type="button"
        class="relative inline-flex size-9 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        :class="touchTargetClass"
        aria-label="Закрити бічну панель"
        @click="close"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <slot :collapsed="collapsed" :close="close" />
    </div>

    <div v-if="$slots.footer" class="border-t border-line p-3">
      <slot name="footer" :collapsed="collapsed" :close="close" />
    </div>
  </aside>
</template>