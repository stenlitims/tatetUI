<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /**
     * Утиліти розміру, напр. `"h-4 w-32"`.
     *
     * Скелетон має повторювати ГЕОМЕТРІЮ того, що замінює. Смужка
     * випадкової довжини на місці картки читається як поламана верстка,
     * а не як завантаження.
     */
    class?: string
    /** Форма кутів. `full` — для кола на місці аватара. */
    rounded?: 'control' | 'card' | 'full'
  }>(),
  { rounded: 'control' },
)

defineSlots<Record<string, never>>()

const roundings: Record<NonNullable<typeof props.rounded>, string> = {
  control: 'rounded-control',
  card: 'rounded-card',
  full: 'rounded-full',
}

/*
 * Тло — `line`, а не `neutral-bg`. У темній темі neutral-bg (#1c2026) на
 * картці (#181b20) давав 1.06:1: скелетон просто зникав, і завантаження
 * виглядало як порожня картка. `line` — той самий сірий, що й межі, тож
 * форма помітна в обох темах, але не кричить.
 */
const classes = computed(() => [
  'relative overflow-hidden bg-line',
  roundings[props.rounded],
  props.class ?? 'h-4 w-full',
])
</script>

<template>
  <!-- aria-hidden: скелетон нічого не повідомляє. Стан завантаження має
       оголошувати контейнер через aria-busy, інакше скрінрідер зачитає
       порожні прямокутники. -->
  <div :class="classes" aria-hidden="true">
    <div class="skeleton-shimmer absolute inset-0" />
  </div>
</template>

<style scoped>
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, var(--ink) 8%, transparent),
    transparent
  );
  animation: skeleton-sweep 1.4s ease-in-out infinite;
}

@keyframes skeleton-sweep {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: none;
  }
}
</style>
