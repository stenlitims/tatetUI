<script setup lang="ts">
import { ref, watch } from 'vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import DocsSearch from '~/components/docs/DocsSearch.vue'
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
    <header
      class="sticky top-0 z-30 flex h-[var(--header-height)] items-center gap-3 border-b border-line bg-card/85 px-4 backdrop-blur"
    >
      <button
        type="button"
        class="-ml-1 flex h-9 w-9 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        aria-label="Відкрити навігацію"
        @click="mobileNavOpen = true"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <NuxtLink to="/" class="font-semibold tracking-tight">tatetUI</NuxtLink>

      <div class="ml-auto flex items-center gap-2">
        <DocsSearch />
        <DocsThemeToggle />
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-[90rem] gap-8 px-4 lg:px-6">
      <aside
        class="scrollbar-thin sticky top-[var(--header-height)] hidden h-[calc(100dvh-var(--header-height))] w-56 shrink-0 overflow-y-auto py-8 lg:block"
      >
        <DocsSidebar />
      </aside>

      <main class="min-w-0 flex-1 py-10">
        <slot />
      </main>
    </div>

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
