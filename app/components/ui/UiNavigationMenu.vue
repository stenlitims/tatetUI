<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
/*
 * NuxtLink — компонентом з #components, як в UiButton: поза Nuxt аліас
 * веде на обгортку над RouterLink, а рядок 'NuxtLink' дав би мертвий тег.
 */
import { NuxtLink } from '#components'
import { computeAnchoredPanelPosition, getOverlayChildZIndex } from '~/utils/overlayPosition'

export interface NavigationMenuChild {
  id: string
  label: string
  description?: string
  /** Маршрут застосунку — NuxtLink, перехід без перезавантаження сторінки. */
  to?: string
  /** Звичайне посилання: зовнішня адреса або якір. */
  href?: string
  disabled?: boolean
  /** Поточна сторінка: `aria-current="page"` і акцентний колір. */
  current?: boolean
}

export interface NavigationMenuItem {
  id: string
  label: string
  /** Маршрут застосунку — NuxtLink, перехід без перезавантаження сторінки. */
  to?: string
  /** Звичайне посилання: зовнішня адреса або якір. */
  href?: string
  disabled?: boolean
  /** Поточна сторінка; для групи — поточний розділ. */
  current?: boolean
  children?: NavigationMenuChild[]
}

const props = withDefaults(
  defineProps<{
    /**
     * Id відкритого пункту або `null`. Використовуйте через `v-model`; без
     * нього меню саме тримає, яка група відкрита.
     */
    modelValue?: string | null
    /**
     * Пункти меню. Пункт із `children` стає кнопкою з панеллю, без них —
     * звичайним посиланням: `to` — маршрут через NuxtLink, `href` — пряма
     * адреса.
     */
    items: NavigationMenuItem[]
    /**
     * Доступна назва навігації. На сторінці зазвичай кілька `nav`, і без
     * назви їх не розрізнити.
     */
    ariaLabel?: string
    /**
     * Розмір пунктів, шеврона і панелі. На дотику кореневі пункти
     * добудовує до 45px невидима зона, а рядки панелі на телефоні — 45px
     * заввишки: нижче 44px палець промахується.
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
    modelValue: undefined,
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
  /** Власний вміст кореневого пункту (без вкладених посилань і кнопок). */
  item?: (props: { item: NavigationMenuItem; open: boolean }) => unknown
  /** Власний вміст пункту панелі. */
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
 * Рядки панелі на телефоні — py-3 з text-base, тобто 45px: це список, де
 * сусіди стоять впритул, і невидима зона одного рядка перекривала б
 * сусідній. Кореневі пункти стоять у ряд — їм вистачає невидимої зони.
 */
const metrics: Record<
  Size,
  { item: string; chevron: string; panel: string; child: string; description: string }
> = {
  sm: {
    item: 'min-h-9 gap-1 px-2.5 text-base md:min-h-8 md:text-xs',
    chevron: 'h-3.5 w-3.5',
    panel: 'p-1.5',
    child: 'px-2.5 py-3 text-base md:py-1.5 md:text-xs',
    description: 'text-xs',
  },
  md: {
    item: 'min-h-10 gap-1.5 px-3 text-base md:min-h-9 md:text-sm',
    chevron: 'h-4 w-4',
    panel: 'p-2',
    child: 'px-3 py-3 text-base md:py-2 md:text-sm',
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
 * `aria-[current=true]` — група, усередині якої поточна сторінка.
 *
 * `active:` не декоративний: на дотику :hover не настає, і без явного
 * стану натискання пункт не дає жодного відгуку.
 */
const itemVariants: Record<Variant, string> = {
  plain:
    'rounded-control text-ink hover:bg-hover active:bg-hover aria-expanded:bg-hover ' +
    'aria-[current=page]:text-accent aria-[current=true]:text-accent',
  underline:
    'rounded-none border-b-2 border-transparent text-muted hover:border-line-strong hover:text-ink active:bg-hover ' +
    'aria-[current=page]:border-accent-solid aria-[current=page]:text-accent ' +
    'aria-[current=true]:border-accent-solid aria-[current=true]:text-accent ' +
    'aria-expanded:border-accent-solid aria-expanded:text-accent',
  pill:
    'rounded-full border border-transparent text-muted hover:border-line hover:bg-hover hover:text-ink active:bg-hover ' +
    'aria-[current=page]:border-primary-200 aria-[current=page]:bg-primary-50 aria-[current=page]:text-accent ' +
    'aria-[current=true]:border-primary-200 aria-[current=true]:bg-primary-50 aria-[current=true]:text-accent ' +
    'aria-expanded:border-primary-200 aria-expanded:bg-primary-50 aria-expanded:text-accent',
}

/*
 * Невидима зона дотику кореневого пункту — лише по вертикалі: пункти
 * стоять у ряд, і ширша зона накривала б сусіда. relative — її якір.
 */
const rootTouchZone =
  "relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-[''] pointer-coarse:after:h-12"

const navEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const triggerRefs = new Map<string, HTMLElement>()
const teleportReady = shallowRef(false)
const panelPosition = shallowRef({ top: '0px', left: '0px', zIndex: '1100' })
const baseId = useId()

/*
 * Без v-model меню тримає стан саме. Раніше стан жив лише в батька: меню
 * без v-model не відкривалося взагалі, хоча Accordion, Expand і Tabs у
 * тій самій ситуації працюють.
 */
const internalOpen = ref<string | null>(null)
const openId = computed(() => (props.modelValue !== undefined ? props.modelValue : internalOpen.value))

function setOpen(id: string | null) {
  if (props.modelValue === undefined) internalOpen.value = id
  emit('update:modelValue', id)
}

const activeItem = computed(() => props.items.find(item => item.id === openId.value && item.children?.length))
const panelId = computed(() => activeItem.value ? `${baseId}-${activeItem.value.id}-panel` : undefined)

function setTriggerRef(id: string, value: Element | ComponentPublicInstance | null) {
  const element = value instanceof HTMLElement ? value : value && '$el' in value ? value.$el as HTMLElement : null
  if (element) triggerRefs.set(id, element)
  else triggerRefs.delete(id)
}

const isSectionCurrent = (item: NavigationMenuItem) =>
  !!item.current || !!item.children?.some(child => child.current)

/*
 * Атрибути посилання. aria-current додається лише для поточного пункту:
 * ключ зі значенням undefined перезаписав би aria-current, який RouterLink
 * сам ставить точно активному маршруту.
 */
function linkAttrs(item: NavigationMenuItem | NavigationMenuChild) {
  const current = item.current ? { 'aria-current': 'page' } : {}
  if (item.disabled) return { ...current, 'aria-disabled': 'true', tabindex: -1 }
  if (item.to) return { ...current, to: item.to }
  if (item.href) return { ...current, href: item.href }
  // Пункт без адреси — дія через @select; tabindex робить <a> фокусованим.
  return { ...current, tabindex: 0 }
}

const linkTag = (item: NavigationMenuItem | NavigationMenuChild) =>
  item.to && !item.disabled ? NuxtLink : 'a'

const enabledRootItems = computed(() =>
  props.items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled),
)

/*
 * Стрілки ←/→ і Home/End — прискорювач між кореневими пунктами. Tab при
 * цьому проходить КОЖЕН пункт: це disclosure-навігація, а не menubar.
 * Ролі menubar/menuitem, що стояли тут раніше, обіцяли скрінрідеру
 * контракт меню (roving tabindex у підменю, стрілки між групами), якого
 * компонент не виконував, і водночас ховали семантику посилань.
 */
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
  triggerRefs.get(target.item.id)?.focus()
}

function childLinks() {
  return panelEl.value
    ? Array.from(panelEl.value.querySelectorAll<HTMLElement>('[data-nav-link]:not([aria-disabled="true"])'))
    : []
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
  if (openId.value !== item.id) setOpen(item.id)
  await nextTick()
  updatePosition()
  if (focusChild) childLinks()[0]?.focus()
}

function close(restore = false) {
  const id = openId.value
  if (!id) return
  setOpen(null)
  if (restore) void nextTick(() => triggerRefs.get(id)?.focus())
}

function activate(item: NavigationMenuItem | NavigationMenuChild) {
  if (item.disabled) return
  emit('select', item)
  if ('children' in item && item.children?.length) void open(item)
  else close(false)
}

/*
 * Панель телепортована в кінець <body>, тож сусідом тригера в порядку Tab
 * вона не є. Tab з відкритого тригера веде в панель явно; Tab з останнього
 * її пункту повертає фокус на тригер і дає браузеру продовжити рух звідти —
 * інакше фокус падав у панель, що зникає, або за кінець документа.
 */
function onRootKeydown(event: KeyboardEvent, index: number, item: NavigationMenuItem) {
  if (event.key === 'Tab') {
    if (event.shiftKey || openId.value !== item.id) return
    const first = childLinks()[0]
    if (!first) return
    event.preventDefault()
    first.focus()
    return
  }
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
  const trigger = openId.value ? triggerRefs.get(openId.value) : undefined
  let next = current
  if (event.key === 'Tab') {
    if (event.shiftKey && current <= 0) {
      event.preventDefault()
      trigger?.focus()
    } else if (!event.shiftKey && current === items.length - 1) {
      close(false)
      trigger?.focus()
    }
    return
  }
  if (event.key === 'ArrowDown') next = (current + 1 + items.length) % items.length
  else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else if (event.key === 'Escape' || event.key === 'ArrowLeft') {
    close(true)
    event.preventDefault()
    return
  } else return
  if (!items.length) return
  event.preventDefault()
  items[next]?.focus()
}

/*
 * Фокус пішов за межі меню й панелі — панель закривається. Раніше вона
 * лишалася висіти над контентом, поки клавіатурний користувач Tab'ом
 * ішов далі сторінкою.
 */
function onFocusOut(event: FocusEvent) {
  if (!openId.value) return
  const next = event.relatedTarget as Node | null
  if (next && (navEl.value?.contains(next) || panelEl.value?.contains(next))) return
  close(false)
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (!openId.value || !target) return
  if (navEl.value?.contains(target) || panelEl.value?.contains(target)) return
  close(false)
}

watch(openId, async (value) => {
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
  <nav ref="navEl" :aria-label="ariaLabel" @focusout="onFocusOut">
    <ul class="flex flex-wrap items-center gap-1">
      <li v-for="(item, index) in items" :key="item.id">
        <button
          v-if="item.children?.length"
          :ref="value => setTriggerRef(item.id, value)"
          type="button"
          :disabled="item.disabled"
          :aria-expanded="openId === item.id"
          :aria-controls="openId === item.id ? panelId : undefined"
          :aria-current="isSectionCurrent(item) ? 'true' : undefined"
          class="inline-flex select-none items-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          :class="[metrics[size].item, itemVariants[variant], rootTouchZone]"
          @click="openId === item.id ? close() : open(item)"
          @keydown="onRootKeydown($event, index, item)"
        >
          <slot name="item" :item="item" :open="openId === item.id">{{ item.label }}</slot>
          <!-- Шеврон — SVG, а не текстовий знак: «⌄» кожен шрифт малює
               по-своєму, дрібно й зі з'їздом від базової лінії. -->
          <svg
            aria-hidden="true"
            class="shrink-0 text-muted transition-transform duration-(--duration-base) ease-emphasized"
            :class="[metrics[size].chevron, { 'rotate-180': openId === item.id }]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <component
          :is="linkTag(item)"
          v-else
          :ref="(value: Element | ComponentPublicInstance | null) => setTriggerRef(item.id, value)"
          v-bind="linkAttrs(item)"
          class="inline-flex select-none items-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50"
          :class="[metrics[size].item, itemVariants[variant], rootTouchZone]"
          @click="activate(item)"
          @keydown="onRootKeydown($event, index, item)"
        >
          <slot name="item" :item="item" :open="false">{{ item.label }}</slot>
        </component>
      </li>
    </ul>
  </nav>

  <Teleport to="body" :disabled="!teleportReady">
    <Transition
      enter-active-class="transition duration-(--duration-base) ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-(--duration-fast) ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <!-- tabindex="-1": клік по полях панелі (не по посиланню) лишає фокус
           усередині, і focusout не закриває панель під курсором. -->
      <div
        v-if="activeItem"
        :id="panelId"
        ref="panelEl"
        tabindex="-1"
        class="fixed rounded-overlay border border-line bg-dropdown shadow-overlay"
        :class="metrics[size].panel"
        :style="{ ...panelPosition, width: panelWidth }"
        @keydown="onPanelKeydown"
        @focusout="onFocusOut"
      >
        <ul>
          <li v-for="child in activeItem.children" :key="child.id">
            <component
              :is="linkTag(child)"
              v-bind="linkAttrs(child)"
              data-nav-link
              class="relative block rounded-control text-ink transition-colors hover:bg-hover active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-[current=page]:bg-hover aria-[current=page]:text-accent"
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
            </component>
          </li>
        </ul>
      </div>
    </Transition>
  </Teleport>
</template>
