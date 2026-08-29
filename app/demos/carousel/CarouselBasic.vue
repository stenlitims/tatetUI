<script setup lang="ts">
import { shallowRef } from 'vue'

const active = shallowRef(0)
const slides = [
  { eyebrow: 'Компоненти', title: 'Copy-first без lock-in', text: 'Код компонента живе у вашому проєкті й лишається повністю редагованим.' },
  { eyebrow: 'Доступність', title: 'Клавіатура як контракт', text: 'ARIA, focus і reduced motion перевіряються разом із поведінкою.' },
  { eyebrow: 'Теми', title: 'Семантичні токени', text: 'Light і dark використовують один набір ролей, а не сирі кольори.' },
]
</script>

<template>
  <UiCarousel v-model="active" :items="slides" loop autoplay aria-label="Переваги tatetUI">
    <template #slide="{ item }">
      <article class="min-h-52 bg-subtle p-8">
        <p class="text-xs font-semibold uppercase tracking-wide text-accent">{{ item.eyebrow }}</p>
        <h3 class="mt-3 text-2xl font-bold text-ink">{{ item.title }}</h3>
        <p class="mt-3 max-w-xl text-sm leading-6 text-muted">{{ item.text }}</p>
      </article>
    </template>
  </UiCarousel>
</template>
