<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Ширина панелі, напр. `"14rem"`. Без неї — за вмістом. */
    width?: string
    /** Куди відкривати відносно тригера. Автоматично фліпається, якщо не влазить. */
    placement?: 'bottom-start' | 'bottom' | 'bottom-end' | 'top' | 'right'
    disabled?: boolean
  }>(),
  { placement: 'bottom-end' },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

defineSlots<{
  /** Тригер. Отримує `toggle` і `isOpen` — кнопку малюєте самі. */
  trigger: (props: { toggle: () => void; isOpen: boolean }) => unknown
  /** Вміст панелі. `toggle` дає змогу закрити меню з пункту. */
  content: (props: { toggle: () => void; isOpen: boolean }) => unknown
}>()

const isOpen = ref(false)
const containerEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)

const panelId = `${useId()}-menu`
const position = ref<Record<string, string>>({ top: '0px', left: '0px' })

const panelStyle = computed(() => {
  const style = { ...position.value }
  if (props.width?.trim()) style.width = props.width
  return style
})

/**
 * Позиція рахується власним кодом, без @floating-ui: компонент має
 * копіюватись у чужий проєкт без нової залежності.
 */
function updatePosition() {
  const trigger = triggerEl.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  // Запасні розміри на перший прохід: до рендеру панель ще не має габаритів.
  const width = menuEl.value?.offsetWidth ?? 200
  const height = menuEl.value?.offsetHeight ?? 100
  const gap = 6
  const edge = 8

  let top: number
  let left: number

  switch (props.placement) {
    case 'bottom-start':
      top = rect.bottom + gap
      left = rect.left
      break
    case 'bottom':
      top = rect.bottom + gap
      left = rect.left + (rect.width - width) / 2
      break
    case 'top':
      top = rect.top - height - gap
      left = rect.left + (rect.width - width) / 2
      break
    case 'right':
      top = rect.top
      left = rect.right + gap
      break
    default:
      top = rect.bottom + gap
      left = rect.right - width
  }

  // Притискання до вікна. Фліп угору лише коли знизу справді не влазить.
  if (left + width > window.innerWidth - edge) left = window.innerWidth - width - edge
  if (left < edge) left = edge
  if (top + height > window.innerHeight - edge) top = rect.top - height - gap
  if (top < edge) top = edge

  position.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

async function open() {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  emit('update:open', true)
  await nextTick()
  updatePosition()
  // Друге вимірювання: перше рахувалося з запасними габаритами і могло
  // помилитися з фліпом.
  await nextTick()
  updatePosition()
}

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  emit('update:open', false)
  // Фокус назад на тригер: без цього після закриття меню Tab починає обхід
  // з початку сторінки, і користувач втрачає місце.
  const focusable = triggerEl.value?.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  ;(focusable ?? triggerEl.value)?.focus?.()
}

function toggle() {
  if (isOpen.value) close()
  else void open()
}

// Панель телепортується в body, тобто формально поза коренем компонента.
// Тому перевіряємо і корінь, і саму панель — інакше клік по її ж пункту
// закривав би меню до того, як спрацює обробник.
function onPointerDown(event: PointerEvent) {
  if (!isOpen.value) return
  const target = event.target as HTMLElement | null
  if (!target) return
  if (containerEl.value?.contains(target)) return
  if (menuEl.value?.contains(target)) return
  // Інші телепортовані шари (випадайка UiSelect, вкладена модалка) теж не
  // мають рахуватись кліком «повз».
  if (target.closest('[role="listbox"], [role="option"], [role="dialog"]')) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isOpen.value) return
  // stopPropagation: інакше той самий Escape закриє ще й модалку, у якій
  // це меню стоїть.
  event.stopPropagation()
  close()
}

function onScrollOrResize() {
  if (isOpen.value) updatePosition()
}

// Перерахунок, коли панель нарешті отримала реальні габарити.
watch(menuEl, (el) => {
  if (el) void nextTick(updatePosition)
})

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', onScrollOrResize, { passive: true })
  // capture: подія scroll не спливає, тож без цього відкрита панель
  // лишалася б висіти на місці, поки контейнер під нею від'їжджає.
  window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', onScrollOrResize)
  window.removeEventListener('scroll', onScrollOrResize, true)
})

defineExpose({
  /** Відкрити меню програмно. */
  open,
  /** Закрити меню програмно. */
  close,
})
</script>

<template>
  <div ref="containerEl" class="relative inline-block">
    <div
      ref="triggerEl"
      :aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? panelId : undefined"
    >
      <slot name="trigger" :toggle="toggle" :is-open="isOpen" />
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <!--
          z-[1100] збігається з dropdownPanelClass у uiFieldStyles.
          Overlay-стек роздає шари з кроком 10 від 1000, тож меню лишається
          над модалкою, у якій воно відкрите.
        -->
        <div
          v-if="isOpen"
          :id="panelId"
          ref="menuEl"
          role="menu"
          class="fixed z-[1100] rounded-control border border-line bg-dropdown py-1 shadow-overlay"
          :style="panelStyle"
        >
          <slot name="content" :toggle="toggle" :is-open="isOpen" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
