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
    /** Id відкритого пункту або `null`. Використовуйте через `v-model`. */
    modelValue?: string | null
    /**
     * Пункти меню. Пункт із `children` стає кнопкою з панеллю, без них —
     * звичайним посиланням.
     */
    items: NavigationMenuItem[]
    /**
     * Доступна назва навігації. На сторінці зазвичай кілька `nav`, і без
     * назви їх не розрізнити.
     */
    ariaLabel?: string
    /**
     * Розмір пунктів, шеврона і панелі. На мобільному кожен розмір вищий
     * за десктопний — нижче 44px палець промахується.
     */
    size?: 'sm' | 'md' | 'lg'
    /**
     * Вигляд кореневих пунктів. `plain` — прозорі з hover-підкладкою,
     * `underline` — підкреслення активної сторінки, `pill` — капсули з
     * брендовою підкладкою на активній.
     */
    variant?: 'plain' | 'underline' | 'pill'
    /** Бажана позиція панелі відносно пункту. */
    placement?: 'bottom-start' | 'bottom' | 'bottom-end'
    /** Ширина панелі, будь-яка CSS-величина. */
    panelWidth?: string
  }>(),
  {
    modelValue: null,
    ariaLabel: 'Головна навігація',
    size: 'md',
    variant: 'plain',
    placement: 'bottom-start',
    panelWidth: '20rem',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  select: [item: NavigationMenuItem | NavigationMenuChild]
}>()

defineSlots<{
  item?: (props: { item: NavigationMenuItem; open: boolean }) => unknown
  child?: (props: { item: NavigationMenuChild; parent: NavigationMenuItem }) => unknown
}>()

/*
 * Аліаси виводяться з типу props, а не оголошуються окремо перед ним:
 * union мусить стояти інлайново в defineProps, інакше в колонці «Тип»
 * таблиці API замість переліку значень буде слово `Size`.
 */
type Size = NonNullable<typeof props.size>
type Variant = NonNullable<typeof props.variant>

/*
 * Розмірні пропорції масштабують УСЕ разом: кореневий пункт, шеврон, панель
 * і її пункти. Панель, що не росте разом із тригером, — типовий розсинхрон
 * скопійованих навігацій: великі кнопки над дрібним списком.
 *
 * Мобільні висоти вищі за десктопні (правило 44px), ієрархія розмірів на
 * телефоні лишається в шрифті й паддінгу.
 */
const metrics: Record<
  Size,
  { item: string; chevron: string; panel: string; child: string; description: string }
> = {
  sm: {
    item: 'min-h-11 gap-1 px-2.5 text-sm md:min-h-8 md:text-xs',
    chevron: 'h-3.5 w-3.5',
    panel: 'p-1.5',
    child: 'px-2.5 py-2 text-sm md:py-1.5 md:text-xs',
    description: 'text-xs',
  },
  md: {
    item: 'min-h-11 gap-1.5 px-3 text-sm md:min-h-9',
    chevron: 'h-4 w-4',
    panel: 'p-2',
    child: 'px-3 py-2.5 text-sm md:py-2',
    description: 'text-xs',
  },
  lg: {
    item: 'min-h-12 gap-2 px-4 text-base md:min-h-10',
    chevron: 'h-5 w-5',
    panel: 'p-2.5',
    child: 'px-3.5 py-3 text-base md:py-2.5',
    description: 'text-sm',
  },
}

/*
 * Вигляд кореневих пунктів.
 *
 * Стан «поточна сторінка» і «панель відкрита» малюються через aria-варіанти
 * (`aria-[current=page]:`, `aria-expanded:`): атрибути й так стоять на
 * елементах, а селектор з атрибутом перебиває базовий колір без гонки
 * порядку правил у згенерованому CSS. Умовний клас цього не гарантує —
 * два однаково специфічні `text-*` виграє той, що нижче в бандлі.
 *
 * `active:` не декоративний: на дотику :hover не настає, і без явного
 * стану натискання пункт не дає жодного відгуку.
 */
const itemVariants: Record<Variant, string> = {
  plain:
    'rounded-control text-ink hover:bg-hover active:bg-hover aria-expanded:bg-hover ' +
    'aria-[current=page]:text-accent',
  underline:
    'rounded-none border-b-2 border-transparent text-muted hover:border-line-strong hover:text-ink active:bg-hover ' +
    'aria-[current=page]:border-accent-solid aria-[current=page]:text-accent ' +
    'aria-expanded:border-accent-solid aria-expanded:text-accent',
  pill:
    'rounded-full border border-transparent text-muted hover:border-line hover:bg-hover hover:text-ink active:bg-hover ' +
    'aria-[current=page]:border-primary-200 aria-[current=page]:bg-primary-50 aria-[current=page]:text-accent ' +
    'aria-expanded:border-primary-200 aria-expanded:bg-primary-50 aria-expanded:text-accent',
}

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

/*
 * computed, а не функція: у шаблоні це читалося на КОЖЕН пункт при кожному
 * рендері й щоразу будувало два нових масиви.
 */
const enabledRootItems = computed(() =>
  props.items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled),
)

/*
 * Roving tabindex: у табуляцію потрапляє рівно один пункт меню, решта
 * доступні стрілками.
 *
 * Раніше цим пунктом ЗАВЖДИ був перший — tabindex рахувався як
 * `index === enabledRootItems()[0]?.index`, тобто константа. Користувач
 * доходив стрілками до п'ятого пункту, виходив Tab'ом далі по сторінці, і
 * Shift+Tab повертав його на перший: позиція в меню губилася при кожному
 * виході. Тепер вона запам'ятовується тут.
 */
const focusedIndex = ref<number | null>(null)

const rovingIndex = computed(() => {
  const enabled = enabledRootItems.value
  if (!enabled.length) return -1
  const remembered = enabled.find(entry => entry.index === focusedIndex.value)
  return (remembered ?? enabled[0]!).index
})

function focusRoot(currentIndex: number, key: 'next' | 'previous' | 'first' | 'last') {
  const items = enabledRootItems.value
  if (!items.length) return
  const current = items.findIndex(entry => entry.index === currentIndex)
  let next = current
  if (key === 'next') next = (current + 1 + items.length) % items.length
  if (key === 'previous') next = (current - 1 + items.length) % items.length
  if (key === 'first') next = 0
  if (key === 'last') next = items.length - 1
  const target = items[next]!
  focusedIndex.value = target.index
  triggerRefs.get(target.item.id)?.focus()
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
          :tabindex="index === rovingIndex ? 0 : -1"
          aria-haspopup="menu"
          :aria-expanded="modelValue === item.id"
          :aria-controls="modelValue === item.id ? panelId : undefined"
          class="inline-flex select-none items-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          :class="[metrics[size].item, itemVariants[variant]]"
          @click="modelValue === item.id ? close() : open(item)"
          @focus="focusedIndex = index"
          @keydown="onRootKeydown($event, index, item)"
        >
          <slot name="item" :item="item" :open="modelValue === item.id">{{ item.label }}</slot>
          <!-- Шеврон — SVG, а не текстовий знак: «⌄» кожен шрифт малює
               по-своєму, дрібно й зі з'їздом від базової лінії. -->
          <svg
            aria-hidden="true"
            class="shrink-0 text-muted transition-transform duration-150"
            :class="[metrics[size].chevron, { 'rotate-180': modelValue === item.id }]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <a
          v-else
          :ref="value => setTriggerRef(item.id, value)"
          :href="item.disabled ? undefined : item.href"
          role="menuitem"
          :aria-current="item.current ? 'page' : undefined"
          :aria-disabled="item.disabled ? 'true' : undefined"
          :tabindex="item.disabled || index !== rovingIndex ? -1 : 0"
          class="inline-flex select-none items-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50"
          :class="[metrics[size].item, itemVariants[variant]]"
          @click="activate(item)"
          @focus="focusedIndex = index"
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
        class="fixed rounded-overlay border border-line bg-dropdown shadow-overlay focus:outline-none"
        :class="metrics[size].panel"
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
          class="block rounded-control text-ink transition-colors hover:bg-hover active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50"
          :class="metrics[size].child"
          @click="activate(child)"
        >
          <slot name="child" :item="child" :parent="activeItem">
            <span class="block font-medium">{{ child.label }}</span>
            <span
              v-if="child.description"
              class="mt-0.5 block text-muted"
              :class="metrics[size].description"
            >{{ child.description }}</span>
          </slot>
        </a>
      </div>
    </Transition>
  </Teleport>
</template>