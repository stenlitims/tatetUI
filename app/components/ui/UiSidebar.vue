<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useOverlayLayer } from '~/composables/useOverlayStack'
import { useScrollLock } from '~/composables/useScrollLock'

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
     * Стабільний id шару в стеку оверлеїв. Задавати не обов'язково:
     * без нього генерується автоматично.
     */
    sidebarId?: string
  }>(),
  {
    modelValue: false,
    collapsed: false,
    side: 'left',
    width: '17rem',
    collapsedWidth: '4.5rem',
    ariaLabel: 'Бічна навігація',
    collapsible: true,
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
const isMobile = shallowRef(false)
const focusTrap = useFocusTrap(() => panelEl.value)
const scrollLock = useScrollLock()
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

function close() {
  if (!props.modelValue) return
  emit('update:modelValue', false)
  emit('close')
}

function toggleCollapsed() {
  if (props.collapsible) emit('update:collapsed', !props.collapsed)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.modelValue) return
  // isTopmost — щоб Escape закривав сайдбар лише тоді, коли поверх нього
  // не відкрито модалку чи меню.
  if (!layer.isTopmost.value) return
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
    focusTrap.activate()
  } else {
    focusTrap.deactivate()
    scrollLock.unlock()
    layer.deactivate()
  }
}, { immediate: true })

onMounted(() => {
  if (typeof window.matchMedia !== 'function') return
  mobileQuery = window.matchMedia('(max-width: 767px)')
  syncMobile()
  mobileQuery.addEventListener('change', syncMobile)
})

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener('change', syncMobile)
  focusTrap.deactivate()
  scrollLock.unlock()
  layer.deactivate()
  layer.settle()
})

defineExpose({ close, toggleCollapsed })
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150"
    leave-to-class="opacity-0"
    @after-leave="layer.settle()"
  >
    <button
      v-if="modelValue"
      type="button"
      class="fixed inset-0 bg-backdrop/50 md:hidden"
      :style="{ zIndex: layer.zIndex.value - 1 }"
      aria-label="Закрити бічну панель"
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
    class="fixed inset-y-0 flex h-[100dvh] w-[var(--ui-sidebar-width)] flex-col border-line bg-card text-ink shadow-overlay transition-[width,transform] duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:shadow-none"
    :class="[sideClasses, mobileTransform, { 'md:w-[var(--ui-sidebar-collapsed-width)]': collapsed }]"
    @keydown="onKeydown"
  >
    <div class="flex min-h-14 items-center gap-2 border-b border-line px-3">
      <div class="min-w-0 flex-1">
        <slot name="header" :collapsed="collapsed" :close="close" />
      </div>
      <button
        v-if="collapsible"
        type="button"
        class="hidden size-9 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
        :aria-label="collapsed ? 'Розгорнути бічну панель' : 'Згорнути бічну панель'"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >
        <span aria-hidden="true">{{ collapsed ? '›' : '‹' }}</span>
      </button>
      <button
        type="button"
        class="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label="Закрити бічну панель"
        @click="close"
      >
        <span aria-hidden="true">×</span>
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
