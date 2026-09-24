<script setup lang="ts">
import HomeCatalog from '~/components/home/HomeCatalog.vue'
import HomeHero from '~/components/home/HomeHero.vue'
import HomePrinciples from '~/components/home/HomePrinciples.vue'
import HomeShowcase from '~/components/home/HomeShowcase.vue'
import HomeSteps from '~/components/home/HomeSteps.vue'

useSeo({
  title: 'Бібліотека UI-компонентів для Vue 3 і Nuxt',
  description:
    'Бібліотека UI-компонентів для Vue і Nuxt, яку копіюють, а не встановлюють: живі приклади реальних екранів, API з коду й документація, що пояснює кожне рішення.',
})
</script>

<template>
  <main id="content">
    <HomeHero />
    <HomeShowcase />
    <HomeCatalog />
    <HomePrinciples />
    <HomeSteps />
  </main>
</template>
