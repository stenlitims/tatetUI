<script setup lang="ts">
import DocsFooter from '~/components/docs/DocsFooter.vue'
import DocsLogo from '~/components/docs/DocsLogo.vue'
import DocsSkipLink from '~/components/docs/DocsSkipLink.vue'
import DocsThemeToggle from '~/components/docs/DocsThemeToggle.vue'
</script>

<template>
  <div class="min-h-dvh bg-main text-ink">
    <DocsSkipLink />

    <!--
      Шапка тут така сама, як у документації, але без пошуку й сайдбару.
      Раніше цей макет був порожньою обгорткою, і на головній не було ні
      знака, ні переходу в документацію — лише кнопки в кінці екранів.
    -->
    <header
      class="sticky top-0 z-30 flex h-[var(--header-height)] items-center gap-3 border-b border-line bg-card/85 px-4 backdrop-blur"
    >
      <NuxtLink
        to="/"
        class="rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="tatetUI — на головну"
      >
        <DocsLogo />
      </NuxtLink>

      <div class="ml-auto flex items-center gap-2">
        <NuxtLink
          to="/docs"
          class="rounded-control px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Документація
        </NuxtLink>
        <DocsThemeToggle />
      </div>
    </header>

    <slot />

    <DocsFooter />
  </div>
</template>
