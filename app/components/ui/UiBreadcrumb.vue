<script setup lang="ts">
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
</script>

<template>
  <!-- Горизонтальний скрол замість переносу: довгий ланцюжок не зламає
       висоту шапки, а останній — найважливіший — пункт лишається видно. -->
  <nav :aria-label="ariaLabel" class="scrollbar-none overflow-x-auto whitespace-nowrap">
    <ol class="flex min-w-max items-center gap-1.5 text-sm">
      <template v-for="(item, index) in items" :key="index">
        <li v-if="index > 0" class="text-muted" aria-hidden="true">
          <slot name="separator">/</slot>
        </li>
        <li class="min-w-0">
          <slot name="item" :item="item" :is-last="index === items.length - 1" :index="index">
            <NuxtLink
              v-if="item.to && index !== items.length - 1"
              :to="item.to"
              class="rounded-control text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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