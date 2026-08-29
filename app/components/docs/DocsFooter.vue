<script setup lang="ts">
import DocsLogo from '~/components/docs/DocsLogo.vue'

defineSlots<Record<string, never>>()

const groups = [
  {
    title: 'Документація',
    links: [
      { title: 'Вступ', to: '/docs' },
      { title: 'Як перенести компонент', to: '/docs/copy-guide' },
      { title: 'Roadmap', to: '/docs/roadmap' },
    ],
  },
  {
    title: 'Основи',
    links: [
      { title: 'Токени', to: '/docs/foundations/tokens' },
      { title: 'Темна тема', to: '/docs/foundations/dark-mode' },
      { title: 'Контракт доступності', to: '/docs/foundations/a11y' },
    ],
  },
  {
    title: 'Часте',
    links: [
      { title: 'Button', to: '/docs/components/button' },
      { title: 'Table', to: '/docs/components/table' },
      { title: 'Modal', to: '/docs/components/modal' },
    ],
  },
]

// Рік рахується один раз під час прередеру. Це не помилка: сторінки
// статичні, і другого рендеру, який міг би дати іншу цифру, не буде.
const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-20 border-t border-line bg-subtle">
    <div class="mx-auto grid max-w-[90rem] gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
      <div>
        <DocsLogo />
        <p class="mt-3 max-w-xs text-sm leading-relaxed text-muted">
          Бібліотека UI-компонентів для Vue 3 і Nuxt. Компоненти копіюються
          в проєкт, а не встановлюються пакетом.
        </p>
      </div>

      <nav v-for="group in groups" :key="group.title" :aria-label="group.title">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ group.title }}</h2>
        <ul class="mt-3 space-y-2">
          <li v-for="link in group.links" :key="link.to">
            <NuxtLink
              :to="link.to"
              class="rounded-control text-sm text-ink transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {{ link.title }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>

    <div class="border-t border-line">
      <p class="mx-auto max-w-[90rem] px-4 py-5 text-xs text-muted lg:px-6">
        © {{ year }} tatetUI. Код компонентів вільно копіюється у ваші проєкти.
      </p>
    </div>
  </footer>
</template>
