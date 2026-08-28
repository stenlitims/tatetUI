<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { getOverlayChildZIndex } from '~/utils/overlayPosition'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    width?: string
    disabled?: boolean
    ariaLabel?: string
  }>(),
  { modelValue: false, width: '14rem', disabled: false, ariaLabel: 'Контекстне меню' },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: []
  close: []
}>()

defineSlots<{
  /** Область, для якої відкривається меню. Передайте `targetAttrs` реальному елементу. */
  default: (props: {
    open: boolean
    targetAttrs: {
      'aria-haspopup': 'menu'
      'aria-expanded': boolean
      'aria-controls': string | undefined
      'aria-disabled': 'true' | undefined
      onContextmenu: (event: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
  }) => unknown
  /** Пункти з `role="menuitem"`. */
  content: (props: { close: () => void }) => unknown
}>()

const rootEl = ref<HTMLElement | null>(null)
const targetEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const teleportReady = shallowRef(false)
const point = shallowRef({ x: 0, y: 0 })
const position = shallowRef({ top: '0px', left: '0px', zIndex: '1100' })
const menuId = `${useId()}-context-menu`

const targetAttrs = computed(() => ({
  'aria-haspopup': 'menu' as const,
  'aria-expanded': props.modelValue,
  'aria-controls': props.modelValue ? menuId : undefined,
  'aria-disabled': props.disabled ? ('true' as const) : undefined,
  onContextmenu: onContextMenu,
  onKeydown: onTargetKeydown,
}))

function enabledItems() {
  return menuEl.value
    ? Array.from(menuEl.value.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]), button:not([disabled]), a[href]:not([aria-disabled="true"])'))
    : []
}

function focusItem(last = false) {
  const items = enabledItems()
  ;(last ? items[items.length - 1] : items[0])?.focus()
}

function updatePosition() {
  if (typeof window === 'undefined') return
  const width = menuEl.value?.offsetWidth || 224
  const height = menuEl.value?.offsetHeight || 160
  const edge = 8
  position.value = {
    top: `${Math.round(Math.max(edge, Math.min(point.value.y, window.innerHeight - height - edge)))}px`,
    left: `${Math.round(Math.max(edge, Math.min(point.value.x, window.innerWidth - width - edge)))}px`,
    zIndex: String(getOverlayChildZIndex(targetEl.value)),
  }
}

async function show(x: number, y: number, source?: HTMLElement | null) {
  if (props.disabled) return
  targetEl.value = source ?? targetEl.value ?? rootEl.value
  point.value = { x, y }
  if (!props.modelValue) {
    emit('update:modelValue', true)
    emit('open')
  }
  await nextTick()
  updatePosition()
  await nextTick()
  updatePosition()
  focusItem()
}

function close(restoreFocus = true) {
  if (!props.modelValue) return
  emit('update:modelValue', false)
  emit('close')
  if (restoreFocus) nextTick(() => targetEl.value?.focus())
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  targetEl.value = event.currentTarget as HTMLElement
  void show(event.clientX, event.clientY, targetEl.value)
}

function onTargetKeydown(event: KeyboardEvent) {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  void show(rect.left + 12, rect.top + 12, target)
}

function onMenuKeydown(event: KeyboardEvent) {
  const items = enabledItems()
  const current = items.indexOf(document.activeElement as HTMLElement)
  let next = current
  if (event.key === 'ArrowDown') next = (current + 1 + items.length) % items.length
  else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else if (event.key === 'Escape') {
    event.stopPropagation()
    close()
    return
  } else if (event.key === 'Tab') {
    close(false)
    return
  } else return
  if (!items.length) return
  event.preventDefault()
  items[next]?.focus()
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!props.modelValue) return
  const target = event.target as Node | null
  if (target && (menuEl.value?.contains(target) || targetEl.value?.contains(target))) return
  close(false)
}

watch(() => props.modelValue, async (open) => {
  if (!open) return
  await nextTick()
  updatePosition()
})

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  window.addEventListener('resize', updatePosition, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('resize', updatePosition)
})

defineExpose({ show, close })
</script>

<template>
  <div ref="rootEl" class="contents">
    <slot :open="modelValue" :target-attrs="targetAttrs" />
  </div>

  <Teleport to="body" :disabled="!teleportReady">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="scale-95 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="modelValue"
        :id="menuId"
        ref="menuEl"
        role="menu"
        :aria-label="ariaLabel"
        data-ui-context-menu
        class="fixed max-h-80 overflow-y-auto rounded-control border border-line bg-dropdown p-1 text-ink shadow-overlay focus:outline-none"
        :style="{ ...position, width }"
        tabindex="-1"
        @keydown="onMenuKeydown"
      >
        <slot name="content" :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>
