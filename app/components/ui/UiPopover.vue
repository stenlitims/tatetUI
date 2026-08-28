<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useId, watch } from 'vue'
import {
  computeAnchoredPanelPosition,
  getOverlayChildZIndex,
  type AnchoredPlacement,
} from '~/utils/overlayPosition'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    placement?: AnchoredPlacement
    width?: string
    disabled?: boolean
    closeOnOutside?: boolean
    closeOnEscape?: boolean
    /** Селектор елемента, який отримує фокус після відкриття. */
    initialFocus?: string
    panelRole?: 'dialog' | 'group' | 'none'
    ariaLabel?: string
  }>(),
  {
    modelValue: false,
    placement: 'bottom-start',
    closeOnOutside: true,
    closeOnEscape: true,
    panelRole: 'dialog',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: []
  close: []
}>()

defineSlots<{
  trigger: (props: {
    open: boolean
    toggle: () => void
    triggerAttrs: Record<string, unknown>
  }) => unknown
  default?: (props: { close: () => void }) => unknown
}>()

const generatedId = useId()
const panelId = `${generatedId}-popover`
const rootEl = shallowRef<HTMLElement | null>(null)
const triggerEl = shallowRef<HTMLElement | null>(null)
const panelEl = shallowRef<HTMLElement | null>(null)
const teleportReady = shallowRef(false)
const panelStyle = shallowRef<Record<string, string>>({})

const triggerAttrs = computed(() => ({
  'aria-haspopup': props.panelRole === 'none' ? undefined : 'dialog',
  'aria-expanded': props.modelValue,
  'aria-controls': props.modelValue ? panelId : undefined,
  'aria-disabled': props.disabled ? 'true' : undefined,
  onClick: toggle,
  onKeydown: onTriggerKeydown,
}))

function focusableTrigger() {
  return triggerEl.value?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
}

function updatePosition() {
  const anchor = focusableTrigger() ?? triggerEl.value
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const panel = { width: panelEl.value?.offsetWidth ?? 240, height: panelEl.value?.offsetHeight ?? 160 }
  const position = computeAnchoredPanelPosition(
    rect,
    panel,
    { width: window.innerWidth, height: window.innerHeight },
    props.placement,
  )
  panelStyle.value = {
    position: 'fixed',
    top: `${Math.round(position.top)}px`,
    left: `${Math.round(position.left)}px`,
    width: props.width || 'auto',
    zIndex: String(getOverlayChildZIndex(anchor)),
  }
}

async function afterOpen(focusFirst = false) {
  await nextTick()
  updatePosition()
  await nextTick()
  updatePosition()
  const target = props.initialFocus
    ? panelEl.value?.querySelector<HTMLElement>(props.initialFocus)
    : focusFirst
      ? panelEl.value?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      : null
  target?.focus()
}

function open(focusFirst = false) {
  if (props.disabled || props.modelValue) return
  emit('update:modelValue', true)
  emit('open')
  void afterOpen(focusFirst)
}

function close(restoreFocus = false) {
  if (!props.modelValue) return
  emit('update:modelValue', false)
  emit('close')
  if (restoreFocus) void nextTick(() => focusableTrigger()?.focus())
}

function toggle() {
  if (props.modelValue) close()
  else open()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown') return
  event.preventDefault()
  open(true)
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!props.modelValue || !props.closeOnOutside) return
  const target = event.target as Node
  if (rootEl.value?.contains(target) || panelEl.value?.contains(target)) return
  close(false)
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.modelValue || !props.closeOnEscape) return
  event.stopPropagation()
  close(true)
}

function onViewportChange() {
  if (props.modelValue) updatePosition()
}

watch(() => props.modelValue, (openValue) => {
  if (openValue) void afterOpen()
})

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown, true)
  window.addEventListener('resize', onViewportChange, { passive: true })
  window.addEventListener('scroll', onViewportChange, { passive: true, capture: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

defineExpose({ open, close, toggle })
</script>

<template>
  <div ref="rootEl" class="relative inline-block">
    <div ref="triggerEl">
      <slot name="trigger" :open="modelValue" :toggle="toggle" :trigger-attrs="triggerAttrs" />
    </div>

    <Teleport to="body" :disabled="!teleportReady">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-95 opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-if="modelValue"
          :id="panelId"
          ref="panelEl"
          :role="panelRole === 'none' ? undefined : panelRole"
          :aria-label="ariaLabel"
          tabindex="-1"
          class="fixed rounded-control border border-line bg-dropdown p-3 text-ink shadow-overlay outline-none"
          :style="panelStyle"
        >
          <slot :close="() => close(true)" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
