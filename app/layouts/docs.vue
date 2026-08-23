<script setup lang="ts">
/**
 * Тимчасовий каркас документації. Повний хром (сайдбар, TOC, пошук,
 * перемикач теми) будується у фазі 5 — і будується з самої бібліотеки,
 * а не з окремих службових компонентів.
 */
</script>

<template>
  <div class="min-h-dvh bg-main text-ink">
    <header
      class="sticky top-0 z-30 flex h-[var(--header-height)] items-center border-b border-line bg-card/80 px-4 backdrop-blur"
    >
      <NuxtLink to="/docs" class="font-semibold">tatetUI</NuxtLink>
    </header>

    <div class="mx-auto max-w-3xl px-4 py-10">
      <slot />
    </div>
  </div>
</template>
