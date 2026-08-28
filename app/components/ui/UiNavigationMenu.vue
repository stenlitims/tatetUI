<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { computeAnchoredPanelPosition, getOverlayChildZIndex } from '~/utils/overlayPosition'

export interface NavigationMenuChild {
  id: string
  label: string
  description?: string
  href?: string
  disabled?: boolean
}

export interface NavigationMenuItem {
  id: string
  label: string
  href?: string
  disabled?: boolean
  current?: boolean
  children?: NavigationMenuChild[]
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    items: NavigationMenuItem[]
    ariaLabel?: string
    placement?: 'bottom-start' | 'bottom' | 'bottom-end'
    panelWidth?: string
  }>(),
  { modelValue: null, ariaLabel: 'Головна навігація', placement: 'bottom-start', panelWidth: '20rem' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  select: [item: NavigationMenuItem | NavigationMenuChild]
}>()

defineSlots<{
  item?: (props: { item: NavigationMenuItem; open: boolean }) => unknown
  child?: (props: { item: NavigationMenuChild; parent: NavigationMenuItem }) => unknown
}>()

const navEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const triggerRefs = new Map<string, HTMLElement>()
const teleportReady = shallowRef(false)
const panelPosition = shallowRef({ top: '0px', left: '0px', zIndex: '1100' })
const baseId = useId()

const activeItem = computed(() => props.items.find(item => item.id === props.modelValue && item.children?.length))
const panelId = computed(() => activeItem.value ? `${baseId}-${activeItem.value.id}-menu` : undefined)

function setTriggerRef(id: string, value: Element | ComponentPublicInstance | null) {
  const element = value instanceof HTMLElement ? value : value && '$el' in value ? value.$el as HTMLElement : null
  if (element) triggerRefs.set(id, element)
  else triggerRefs.delete(id)
}

function enabledRootItems() {
  return props.items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled)
}

function focusRoot(currentIndex: number, key: 'next' | 'previous' | 'first' | 'last') {
  const items = enabledRootItems()
  if (!items.length) return
  const current = items.findIndex(entry => entry.index === currentIndex)
  let next = current
  if (key === 'next') next = (current + 1 + items.length) % items.length
  if (key === 'previous') next = (current - 1 + items.length) % items.length
  if (key === 'first') next = 0
  if (key === 'last') next = items.length - 1
  triggerRefs.get(items[next]!.item.id)?.focus()
}

function childLinks() {
  return panelEl.value ? Array.from(panelEl.value.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')) : []
}

function updatePosition() {
  const item = activeItem.value
  if (!item || typeof window === 'undefined') return
  const trigger = triggerRefs.get(item.id)
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const point = computeAnchoredPanelPosition(
    rect,
    { width: panelEl.value?.offsetWidth || 320, height: panelEl.value?.offsetHeight || 160 },
    { width: window.innerWidth, height: window.innerHeight },
    props.placement,
  )
  panelPosition.value = {
    top: `${Math.round(point.top)}px`,
    left: `${Math.round(point.left)}px`,
    zIndex: String(getOverlayChildZIndex(trigger)),
  }
}

async function open(item: NavigationMenuItem, focusChild = false) {
  if (item.disabled || !item.children?.length) return
  emit('update:modelValue', item.id)
  await nextTick()
  updatePosition()
  if (focusChild) childLinks()[0]?.focus()
}

function close(restore = false) {
  const id = props.modelValue
  emit('update:modelValue', null)
  if (restore && id) nextTick(() => triggerRefs.get(id)?.focus())
}

function activate(item: NavigationMenuItem | NavigationMenuChild) {
  if (item.disabled) return
  emit('select', item)
  if ('children' in item && item.children?.length) void open(item)
  else close(false)
}

function onRootKeydown(event: KeyboardEvent, index: number, item: NavigationMenuItem) {
  if (event.key === 'ArrowRight') focusRoot(index, 'next')
  else if (event.key === 'ArrowLeft') focusRoot(index, 'previous')
  else if (event.key === 'Home') focusRoot(index, 'first')
  else if (event.key === 'End') focusRoot(index, 'last')
  else if (event.key === 'ArrowDown' && item.children?.length) void open(item, true)
  else if (event.key === 'Escape') close(false)
  else return
  event.preventDefault()
}

function onPanelKeydown(event: KeyboardEvent) {
  const items = childLinks()
  const current = items.indexOf(document.activeElement as HTMLElement)
  let next = current
  if (event.key === 'ArrowDown') next = (current + 1 + items.length) % items.length
  else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else if (event.key === 'Escape' || event.key === 'ArrowLeft') {
    close(true)
    event.preventDefault()
    return
  } else if (event.key === 'Tab') {
    close(false)
    return
  } else return
  if (!items.length) return
  event.preventDefault()
  items[next]?.focus()
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (!props.modelValue || !target) return
  if (navEl.value?.contains(target) || panelEl.value?.contains(target)) return
  close(false)
}

watch(() => props.modelValue, async (value) => {
  if (!value) return
  await nextTick()
  updatePosition()
})

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('resize', updatePosition, { passive: true })
  window.addEventListener('scroll', updatePosition, { passive: true, capture: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
  triggerRefs.clear()
})
</script>

<template>
  <nav ref="navEl" :aria-label="ariaLabel">
    <ul role="menubar" class="flex flex-wrap items-center gap-1">
      <li v-for="(item, index) in items" :key="item.id" role="none">
        <button
          v-if="item.children?.length"
          :ref="value => setTriggerRef(item.id, value)"
          type="button"
          role="menuitem"
          :disabled="item.disabled"
          :tabindex="index === enabledRootItems()[0]?.index ? 0 : -1"
          aria-haspopup="menu"
          :aria-expanded="modelValue === item.id"
          :aria-controls="modelValue === item.id ? panelId : undefined"
          class="inline-flex min-h-10 items-center gap-1 rounded-control px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          @click="modelValue === item.id ? close() : open(item)"
          @keydown="onRootKeydown($event, index, item)"
        >
          <slot name="item" :item="item" :open="modelValue === item.id">{{ item.label }}</slot>
          <span aria-hidden="true" class="transition-transform" :class="{ 'rotate-180': modelValue === item.id }">⌄</span>
        </button>
        <a
          v-else
          :ref="value => setTriggerRef(item.id, value)"
          :href="item.disabled ? undefined : item.href"
          role="menuitem"
          :aria-current="item.current ? 'page' : undefined"
          :aria-disabled="item.disabled ? 'true' : undefined"
          :tabindex="item.disabled || index !== enabledRootItems()[0]?.index ? -1 : 0"
          class="inline-flex min-h-10 items-center rounded-control px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50"
          @click="activate(item)"
          @keydown="onRootKeydown($event, index, item)"
        >
          <slot name="item" :item="item" :open="false">{{ item.label }}</slot>
        </a>
      </li>
    </ul>
  </nav>

  <Teleport to="body" :disabled="!teleportReady">
    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="-translate-y-1 opacity-0" leave-active-class="transition duration-100 ease-in" leave-to-class="-translate-y-1 opacity-0">
      <div
        v-if="activeItem"
        :id="panelId"
        ref="panelEl"
        role="menu"
        :aria-label="activeItem.label"
        class="fixed rounded-overlay border border-line bg-dropdown p-2 shadow-overlay focus:outline-none"
        :style="{ ...panelPosition, width: panelWidth }"
        @keydown="onPanelKeydown"
      >
        <a
          v-for="child in activeItem.children"
          :key="child.id"
          :href="child.disabled ? undefined : child.href"
          role="menuitem"
          :aria-disabled="child.disabled ? 'true' : undefined"
          :tabindex="child.disabled ? -1 : 0"
          class="block rounded-control px-3 py-2.5 text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50"
          @click="activate(child)"
        >
          <slot name="child" :item="child" :parent="activeItem">
            <span class="block text-sm font-medium">{{ child.label }}</span>
            <span v-if="child.description" class="mt-0.5 block text-xs text-muted">{{ child.description }}</span>
          </slot>
        </a>
      </div>
    </Transition>
  </Teleport>
</template>
