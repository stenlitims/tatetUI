<script setup lang="ts">
useHead({ title: 'tatetUI — бібліотека UI-компонентів' })
useSeoMeta({
  description:
    'Канонічна бібліотека UI-компонентів для проєктів на Nuxt: копіюй код, а не встановлюй пакет.',
})
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-16">
    <h1 class="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">tatetUI</h1>
    <p class="mt-4 text-lg text-muted">
      Канонічна бібліотека UI-компонентів. Копіюй код, а не встановлюй пакет.
    </p>
    <div class="mt-8">
      <NuxtLink
        to="/docs"
        class="inline-flex h-12 items-center rounded-control bg-accent-solid px-5 font-semibold text-accent-contrast transition-colors hover:bg-accent-solid-hover md:h-10"
      >
        Документація
      </NuxtLink>
    </div>
  </main>
</template>
