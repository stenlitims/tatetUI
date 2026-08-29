<script setup lang="ts">
/**
 * Посилання «Перейти до вмісту».
 *
 * У сайдбарі документації близько шістдесяти посилань, і без цього кроку
 * клавіатурний користувач проходить їх ЗАНОВО на кожній сторінці, перш ніж
 * дістатися тексту.
 *
 * Приховане не через `hidden` і не через нульовий розмір: такий елемент
 * недосяжний і для фокуса теж. Воно винесене за межі екрана і повертається
 * рівно на час, поки має фокус.
 */
defineSlots<Record<string, never>>()
</script>

<template>
  <a
    href="#content"
    class="sr-only rounded-control border border-line bg-card px-4 py-2 text-sm font-medium text-ink shadow-overlay focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-3 focus-visible:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    Перейти до вмісту
  </a>
</template>
