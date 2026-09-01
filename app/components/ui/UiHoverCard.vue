<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import type { AnchoredPlacement } from '~/utils/overlayPosition'
import { computeAnchoredPanelPosition, getOverlayChildZIndex } from '~/utils/overlayPosition'

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /** Бажана позиція картки. Не вміщається — перевертається. */
    placement?: AnchoredPlacement
    /**
     * Затримка перед показом, мс. Без неї картка блимає при кожному
     * проході курсора повз посилання.
     */
    openDelay?: number
    /**
     * Затримка перед приховуванням, мс. Дає час довести курсор від
     * тригера до самої картки.
     */
    closeDelay?: number
    /** Ширина картки, будь-яка CSS-величина. */
    width?: string
    disabled?: boolean
    /** Доступна назва картки. */
    ariaLabel?: string
  }>(),
  {
    modelValue: false,
    placement: 'bottom-start',
    openDelay: 400,
    closeDelay: 250,
    width: '20rem',
    disabled: false,
    ariaLabel: 'Додаткова інформація',
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
    triggerAttrs: {
      'aria-expanded': boolean
      'aria-controls': string | undefined
      'aria-describedby': string | undefined
      onMouseenter: (event: MouseEvent) => void
      onMouseleave: () => void
      onFocus: (event: FocusEvent) => void
      onBlur: () => void
      onKeydown: (event: KeyboardEvent) => void
    }
  }) => unknown
  default: (props: { close: () => void }) => unknown
}>()

const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const teleportReady = shallowRef(false)
const panelHovered = shallowRef(false)
const triggerFocused = shallowRef(false)
const position = shallowRef({ top: '0px', left: '0px', zIndex: '1100' })
const panelId = `${useId()}-hover-card`
let openTimer: number | null = null
let closeTimer: number | null = null

const triggerAttrs = computed(() => ({
  'aria-expanded': props.modelValue,
  'aria-controls': props.modelValue ? panelId : undefined,
  'aria-describedby': props.modelValue ? panelId : undefined,
  onMouseenter: onTriggerMouseenter,
  onMouseleave: scheduleClose,
  onFocus: onTriggerFocus,
  onBlur: onTriggerBlur,
  onKeydown: onTriggerKeydown,
}))

function clearTimers() {
  if (openTimer !== null) window.clearTimeout(openTimer)
  if (closeTimer !== null) window.clearTimeout(closeTimer)
  openTimer = null
  closeTimer = null
}

function updatePosition() {
  const trigger = triggerEl.value
  if (!trigger || typeof window === 'undefined') return
  const rect = trigger.getBoundingClientRect()
  const point = computeAnchoredPanelPosition(
    rect,
    { width: panelEl.value?.offsetWidth || 320, height: panelEl.value?.offsetHeight || 160 },
    { width: window.innerWidth, height: window.innerHeight },
    props.placement,
  )
  position.value = {
    top: `${Math.round(point.top)}px`,
    left: `${Math.round(point.left)}px`,
    zIndex: String(getOverlayChildZIndex(trigger)),
  }
}

async function open() {
  if (props.disabled) return
  clearTimers()
  if (!props.modelValue) {
    emit('update:modelValue', true)
    emit('open')
  }
  await nextTick()
  updatePosition()
  await nextTick()
  updatePosition()
}

function close() {
  clearTimers()
  if (!props.modelValue) return
  emit('update:modelValue', false)
  emit('close')
}

function scheduleOpen() {
  if (props.disabled || props.modelValue) return
  clearTimers()
  openTimer = window.setTimeout(() => void open(), Math.max(0, props.openDelay))
}

function scheduleClose() {
  if (triggerFocused.value || panelHovered.value) return
  if (closeTimer !== null) window.clearTimeout(closeTimer)
  closeTimer = window.setTimeout(() => {
    if (!triggerFocused.value && !panelHovered.value) close()
  }, Math.max(0, props.closeDelay))
}

function onTriggerFocus(event: FocusEvent) {
  triggerEl.value = event.currentTarget as HTMLElement
  triggerFocused.value = true
  scheduleOpen()
}

function onTriggerMouseenter(event: MouseEvent) {
  triggerEl.value = event.currentTarget as HTMLElement
  scheduleOpen()
}

function onTriggerBlur() {
  triggerFocused.value = false
  scheduleClose()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  close()
}

function onRootMouseenter(event: MouseEvent) {
  triggerEl.value = rootEl.value?.querySelector<HTMLElement>('a, button, [tabindex]')
    ?? (event.target instanceof HTMLElement ? event.target : rootEl.value)
  scheduleOpen()
}

watch(() => props.modelValue, async (visible) => {
  if (!visible) return
  await nextTick()
  updatePosition()
})

onMounted(() => {
  teleportReady.value = true
  window.addEventListener('resize', updatePosition, { passive: true })
  window.addEventListener('scroll', updatePosition, { passive: true, capture: true })
})

onBeforeUnmount(() => {
  clearTimers()
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})

defineExpose({ open, close })
</script>

<template>
  <span ref="rootEl" class="contents" @mouseenter="onRootMouseenter">
    <slot name="trigger" :open="modelValue" :trigger-attrs="triggerAttrs" />
  </span>

  <Teleport to="body" :disabled="!teleportReady">
    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="translate-y-1 scale-[0.98] opacity-0" leave-active-class="transition duration-100 ease-in" leave-to-class="translate-y-1 scale-[0.98] opacity-0">
      <div
        v-if="modelValue"
        :id="panelId"
        ref="panelEl"
        role="dialog"
        :aria-label="ariaLabel"
        class="fixed rounded-overlay border border-line bg-dropdown p-4 text-ink shadow-overlay"
        :class="placement.startsWith('top') ? 'origin-bottom' : 'origin-top'"
        :style="{ ...position, width }"
        @mouseenter="panelHovered = true; clearTimers()"
        @mouseleave="panelHovered = false; scheduleClose()"
        @focusin="panelHovered = true; clearTimers()"
        @focusout="panelHovered = false; scheduleClose()"
        @keydown.esc.stop="close"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>
