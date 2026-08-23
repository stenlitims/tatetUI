<script setup lang="ts">
import { useTheme } from '~/composables/useTheme'

const { isDark, toggle } = useTheme()
</script>

<template>
  <button
    type="button"
    class="flex h-9 w-9 items-center justify-center rounded-control border border-line text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :aria-label="isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'"
    :aria-pressed="isDark"
    @click="toggle"
  >
    <!-- ClientOnly навколо іконки, а не кнопки: сама кнопка має бути в
         прередереному HTML, щоб шапка не стрибала після гідрації. Іконка ж
         залежить від теми, яку сервер не знає. -->
    <ClientOnly>
      <svg v-if="isDark" class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" />
        <path
          d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </svg>
      <template #fallback>
        <span class="h-4 w-4" />
      </template>
    </ClientOnly>
  </button>
</template>
