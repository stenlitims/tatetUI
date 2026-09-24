<script setup lang="ts">
/**
 * Рамка «вікна застосунку» для прикладів на головній.
 *
 * Не компонент бібліотеки — декорація вітрини: дає екрану-прикладу
 * контекст (адреса, межі вікна), щоб він читався як продукт, а не як набір
 * компонентів на порожньому тлі.
 */
withDefaults(
  defineProps<{
    /** Адреса в рядку вікна — підказка, у якому продукті ми «знаходимось». */
    url?: string
  }>(),
  { url: '' },
)

defineSlots<{
  default?: () => unknown
  /** Праворуч у рядку вікна: кошик, дзвіночок, аватар. */
  toolbar?: () => unknown
}>()
</script>

<template>
  <!--
    overflow-clip, а не overflow-hidden: hidden створює власну область
    прокрутки, і липкі елементи всередині (UiActionBar, шапки таблиць)
    прилипали б до вікна-рамки, а не до екрана. clip лише обрізає кути.
  -->
  <div class="overflow-clip rounded-overlay border border-line bg-card shadow-overlay">
    <div class="flex h-11 items-center gap-3 border-b border-line bg-subtle px-3 sm:px-4">
      <div class="flex shrink-0 gap-1.5" aria-hidden="true">
        <span class="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span class="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span class="h-2.5 w-2.5 rounded-full bg-line-strong" />
      </div>
      <div class="mx-auto flex min-w-0 max-w-sm flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
        <svg class="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span class="truncate">{{ url }}</span>
      </div>
      <div class="flex min-w-[2.625rem] shrink-0 items-center justify-end gap-1">
        <slot name="toolbar" />
      </div>
    </div>
    <slot />
  </div>
</template>
