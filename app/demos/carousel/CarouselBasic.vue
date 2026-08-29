<script setup lang="ts">
import { shallowRef } from 'vue'

const active = shallowRef(0)
const slides = [
  {
    eyebrow: 'Компоненти',
    title: 'Copy-first без lock-in',
    text: 'Код компонента живе у вашому проєкті й лишається повністю редагованим.',
    meta: '0 залежностей',
  },
  {
    eyebrow: 'Доступність',
    title: 'Клавіатура як контракт',
    text: 'ARIA, focus і reduced motion перевіряються разом із поведінкою.',
    meta: '142 тести',
  },
  {
    eyebrow: 'Теми',
    title: 'Семантичні токени',
    text: 'Light і dark використовують один набір ролей, а не сирі кольори.',
    meta: '2 теми',
  },
]
</script>

<template>
  <UiCarousel v-model="active" :items="slides" loop autoplay aria-label="Переваги tatetUI">
    <template #slide="{ item }">
      <article class="min-h-52 overflow-hidden rounded-overlay border border-line bg-card shadow-card">
        <!-- Верхня акцентна смуга: тонкий слід бренду, що не конкурує з
             контентом, але прибирає «порожнє» відчуття плоского слайда. -->
        <div class="h-1 bg-gradient-to-r from-primary-400 to-primary-600" aria-hidden="true" />
        <div class="flex flex-col justify-center p-8 md:p-10">
          <p class="text-xs font-semibold uppercase tracking-widest text-accent">{{ item.eyebrow }}</p>
          <h3 class="mt-3 text-2xl font-bold text-ink md:text-3xl">{{ item.title }}</h3>
          <p class="mt-3 max-w-xl text-sm leading-6 text-muted md:text-base md:leading-7">{{ item.text }}</p>
          <p class="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span class="inline-block size-1.5 rounded-full bg-success" aria-hidden="true" />
            {{ item.meta }}
          </p>
        </div>
      </article>
    </template>
  </UiCarousel>
</template>