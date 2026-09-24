<script setup lang="ts">
import DocsFooter from '~/components/docs/DocsFooter.vue'
import DocsLogo from '~/components/docs/DocsLogo.vue'
import DocsSkipLink from '~/components/docs/DocsSkipLink.vue'
import DocsThemeToggle from '~/components/docs/DocsThemeToggle.vue'

/*
 * На телефоні лишається одне посилання — «Документація»: чотири пункти в
 * шапці 56px заввишки переносилися б у другий рядок або злипалися.
 */
const links = [
  { title: 'Приклади', to: '/#examples', mobile: false },
  { title: 'Компоненти', to: '/docs/components/button', mobile: false },
  { title: 'Roadmap', to: '/docs/roadmap', mobile: false },
  { title: 'Документація', to: '/docs', mobile: true },
]
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

      <nav aria-label="Основна навігація" class="ml-auto flex items-center gap-1 sm:ml-6 sm:mr-auto">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="rounded-control px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="link.mobile ? '' : 'hidden sm:inline-flex'"
        >
          {{ link.title }}
        </NuxtLink>
      </nav>

      <DocsThemeToggle />
    </header>

    <slot />

    <DocsFooter />
  </div>
</template>
