<script setup lang="ts">
import { docsNav } from '~/config/docsNav'

const route = useRoute()

const emit = defineEmits<{
  /** Клік по посиланню. Мобільна навігація на цьому закривається. */
  navigate: []
}>()

function isActive(to: string) {
  return route.path === to || route.path === `${to}/`
}
</script>

<template>
  <nav aria-label="Розділи документації" class="text-sm">
    <div v-for="group in docsNav" :key="group.title" class="mb-6">
      <p class="mb-2 px-3 text-xs font-semibold tracking-wide text-muted uppercase">
        {{ group.title }}
      </p>
      <ul class="space-y-0.5">
        <li v-for="item in group.items" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex items-center justify-between gap-2 rounded-control px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="
              isActive(item.to)
                ? 'bg-primary-50 font-medium text-accent'
                : 'text-muted hover:bg-hover hover:text-ink'
            "
            :aria-current="isActive(item.to) ? 'page' : undefined"
            @click="emit('navigate')"
          >
            <span>{{ item.title }}</span>
            <span
              v-if="item.status && item.status !== 'stable'"
              class="rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-warning"
            >
              {{ item.status }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
