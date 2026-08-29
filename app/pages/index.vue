<script setup lang="ts">
import HomeComponentGallery from '~/components/home/HomeComponentGallery.vue'
import HomeDataWorkflow from '~/components/home/HomeDataWorkflow.vue'
import HomeHeroDemo from '~/components/home/HomeHeroDemo.vue'
import UiButton from '~/components/ui/UiButton.vue'

useSeo({
  title: 'Бібліотека UI-компонентів для Vue 3 і Nuxt',
  description:
    'Канонічна бібліотека UI-компонентів для Nuxt — копіюй код, перевіряй живі сценарії та адаптуй під продукт.',
})
</script>

<template>
  <main id="content">
    <HomeHeroDemo />
    <HomeDataWorkflow />
    <HomeComponentGallery />

    <section class="mx-auto max-w-6xl px-4 pb-24">
      <div class="flex flex-col items-start justify-between gap-6 rounded-overlay border border-line bg-card p-8 shadow-overlay sm:flex-row sm:items-center">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight text-ink">Почни з одного компонента</h2>
          <p class="mt-2 max-w-md text-muted">
            Відкрий API, скопіюй компонент разом із його локальними залежностями та адаптуй під свій проєкт.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton to="/docs/components/button" size="lg">Відкрити Button</UiButton>
          <UiButton to="/docs/roadmap" variant="outline" size="lg">Що далі</UiButton>
        </div>
      </div>
    </section>
  </main>
</template>
