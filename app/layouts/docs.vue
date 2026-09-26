<script setup lang="ts">
import { ref, watch } from 'vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import DocsFooter from '~/components/docs/DocsFooter.vue'
import DocsLogo from '~/components/docs/DocsLogo.vue'
import DocsSearch from '~/components/docs/DocsSearch.vue'
import DocsSkipLink from '~/components/docs/DocsSkipLink.vue'
import DocsSidebar from '~/components/docs/DocsSidebar.vue'
import DocsThemeToggle from '~/components/docs/DocsThemeToggle.vue'

const mobileNavOpen = ref(false)
const route = useRoute()

// Закривати меню при переході. Без цього drawer лишався б відкритим над
// новою сторінкою — типовий баг мобільної навігації.
watch(() => route.path, () => (mobileNavOpen.value = false))
</script>

<template>
  <div class="min-h-dvh bg-main text-ink">
    <DocsSkipLink />

    <header
      class="sticky top-0 z-30 flex h-[var(--header-height)] items-center gap-3 border-b border-line bg-card/85 px-4 backdrop-blur"
    >
      <button
        type="button"
        class="relative -ml-1 flex h-9 w-9 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
        aria-label="Відкрити навігацію"
        @click="mobileNavOpen = true"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <NuxtLink
        to="/"
        class="rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="tatetUI — на головну"
      >
        <DocsLogo />
      </NuxtLink>

      <div class="ml-auto flex items-center gap-2">
        <DocsSearch />
        <DocsThemeToggle />
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-[90rem] gap-8 px-4 lg:px-6">
      <aside
        aria-label="Розділи документації"
        class="scrollbar-thin sticky top-[var(--header-height)] hidden h-[calc(100dvh-var(--header-height))] w-56 shrink-0 overflow-y-auto py-8 lg:block"
      >
        <DocsSidebar />
      </aside>

      <main id="content" class="min-w-0 flex-1 py-10">
        <slot />
      </main>
    </div>

    <DocsFooter />

    <!--
      Мобільна навігація — справжній UiDrawer із бібліотеки, а не окремий
      службовий компонент. Якщо власну документацію незручно збирати зі
      своїх же компонентів, з бібліотекою щось не так.
    -->
    <UiDrawer v-model="mobileNavOpen" position="left" size="xs" title="Навігація" close-on-backdrop>
      <DocsSidebar @navigate="mobileNavOpen = false" />
    </UiDrawer>
  </div>
</template>
