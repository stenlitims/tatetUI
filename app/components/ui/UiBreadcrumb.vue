<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
/*
 * Компонент, а НЕ глобальний тег <NuxtLink>. Поза Nuxt глобального
 * NuxtLink немає, і Vue рендерив літеральний <nuxtlink> — мертве посилання.
 * Імпорт з #components той самий, що в UiButton: у Vite-проєкті аліас
 * вказує на власну обгортку над RouterLink.
 */
import { NuxtLink } from '#components'

export interface BreadcrumbItem {
  label: string
  /** Маршрут. Останній пункт і пункти без `to` рендеряться текстом. */
  to?: string
}

const props = withDefaults(
  defineProps<{
    /** Ланцюжок від кореня до поточного місця. */
    items: BreadcrumbItem[]
    /** Доступна назва навігації. */
    ariaLabel?: string
  }>(),
  { ariaLabel: 'Навігація' },
)

defineSlots<{
  /** Власний рендер пункту. */
  item?: (props: { item: BreadcrumbItem; isLast: boolean; index: number }) => unknown
  /** Розділювач між пунктами. */
  separator?: () => unknown
}>()

const navEl = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

/*
 * Довгий ланцюжок скролиться по X, і прокрутка стартує з нуля — тобто з
 * КОРЕНЯ. На телефоні поточна сторінка (найважливіший пункт) опинялась за
 * правим краєм під прихованим скролбаром. Тримаємо видимим кінець: при
 * монтуванні, зміні пунктів і зміні ширини.
 */
function revealCurrent() {
  const nav = navEl.value
  if (!nav || nav.scrollWidth <= nav.clientWidth) return
  // У RTL «кінець» — ліворуч, і scrollLeft там від'ємний.
  const rtl = getComputedStyle(nav).direction === 'rtl'
  nav.scrollLeft = rtl ? -nav.scrollWidth : nav.scrollWidth
}

onMounted(() => {
  revealCurrent()
  if (typeof ResizeObserver !== 'undefined' && navEl.value) {
    resizeObserver = new ResizeObserver(() => revealCurrent())
    resizeObserver.observe(navEl.value)
    // І список: довантажений шрифт розширює пункти, не змінюючи ширини nav.
    if (navEl.value.firstElementChild) resizeObserver.observe(navEl.value.firstElementChild)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(() => props.items, () => void nextTick(revealCurrent), { deep: true })

/*
 * Ланцюжок прокручено до кінця, тож Tab починає з посилань, захованих
 * ліворуч. Chromium на фокус докручує смугу лише до посилання, схованого
 * повністю, і то по центру; частково видиме лишає обрізаним разом із
 * фокус-кільцем. `nearest` разом зі scroll-padding показує його цілим.
 * Лише для фокуса з клавіатури: прокрутка посеред кліку чи тапу зсунула б
 * посилання з-під пальця.
 */
function onNavFocusin(event: FocusEvent) {
  const target = event.target as HTMLElement
  if (target.matches(':focus-visible')) target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
</script>

<template>
  <!-- Горизонтальний скрол замість переносу: довгий ланцюжок не зламає
       висоту шапки, а останній — найважливіший — пункт лишається видно. -->
  <!--
    py-3.5 -my-3.5: місце для невидимої зони дотику посилань. overflow-x-auto
    обрізає й по вертикалі, тож 45px зона навколо 19px рядка без цього
    різалася б по висоті рядка. px-1 -mx-1 — те саме для фокус-кільця
    (2px) крайнього посилання, яке рамка смуги інакше зрізала збоку, а
    scroll-px-1 — той самий відступ, коли фокус докручує посилання
    (onNavFocusin). Від'ємний margin повертає розкладку як була.
  -->
  <nav
    ref="navEl"
    :aria-label="ariaLabel"
    class="scrollbar-none -mx-1 -my-3.5 overflow-x-auto whitespace-nowrap px-1 py-3.5 scroll-px-1"
    @focusin="onNavFocusin"
  >
    <ol class="flex min-w-max items-center gap-1.5 text-sm">
      <template v-for="(item, index) in items" :key="index">
        <li v-if="index > 0" class="flex text-muted" aria-hidden="true">
          <slot name="separator">
            <svg class="h-3.5 w-3.5 opacity-70" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </slot>
        </li>
        <li class="min-w-0">
          <slot name="item" :item="item" :is-last="index === items.length - 1" :index="index">
            <NuxtLink
              v-if="item.to && index !== items.length - 1"
              :to="item.to"
              class="relative rounded-control text-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-[max(100%,3rem)] pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
            >
              {{ item.label }}
            </NuxtLink>
            <span
              v-else
              class="font-medium text-ink"
              :aria-current="index === items.length - 1 ? 'page' : undefined"
            >
              {{ item.label }}
            </span>
          </slot>
        </li>
      </template>
    </ol>
  </nav>
</template>
