<script setup lang="ts">
import { computed } from 'vue'
import { docsNav, type NavLink } from '~/config/docsNav'

const route = useRoute()

// Сайдбар — джерело порядку. Гортання має збігатися з тим, що людина
// бачить у меню, а не з алфавітом чи структурою каталогів.
const flat = computed<NavLink[]>(() => docsNav.flatMap((group) => group.items))

const index = computed(() =>
  flat.value.findIndex((item) => item.to === route.path || `${item.to}/` === route.path),
)

const prev = computed(() => (index.value > 0 ? flat.value[index.value - 1] : null))
const next = computed(() =>
  index.value >= 0 && index.value < flat.value.length - 1 ? flat.value[index.value + 1] : null,
)
</script>

<template>
  <nav
    v-if="prev || next"
    class="mt-12 flex items-stretch gap-3 border-t border-line pt-6"
    aria-label="Сусідні сторінки"
  >
    <NuxtLink
      v-if="prev"
      :to="prev.to"
      class="flex flex-1 flex-col rounded-card border border-line px-4 py-3 transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span class="text-xs text-muted">Попереднє</span>
      <span class="mt-0.5 font-medium text-ink">{{ prev.title }}</span>
    </NuxtLink>
    <NuxtLink
      v-if="next"
      :to="next.to"
      class="flex flex-1 flex-col items-end rounded-card border border-line px-4 py-3 text-right transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span class="text-xs text-muted">Наступне</span>
      <span class="mt-0.5 font-medium text-ink">{{ next.title }}</span>
    </NuxtLink>
  </nav>
</template>
