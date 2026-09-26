<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
import UiCopyButton from '~/components/ui/UiCopyButton.vue'

defineSlots<Record<string, never>>()

const steps = [
  {
    title: 'Один раз — токени',
    text: 'Скопіюйте tokens.css і підключіть його після Tailwind. Файл — чистий CSS, однаковий для v3 і v4.',
    code: "@import './tokens.css';",
  },
  {
    title: 'Компонент і його залежності',
    text: 'На сторінці компонента є кнопка копіювання коду й список dependsOn — файли, без яких він не запрацює.',
    code: 'app/components/ui/UiRating.vue',
  },
  {
    title: 'Далі — ваш код',
    text: 'Імпортуйте як звичайний SFC і правте під свій екран. Оновлювати пакет нема чого: пакета немає.',
    code: "import UiRating from '~/components/ui/UiRating.vue'",
  },
]
</script>

<template>
  <section class="py-20 sm:py-24" aria-labelledby="steps-title">
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold text-accent">Як почати</p>
        <h2 id="steps-title" class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Три кроки від сторінки документації до вашого екрана
        </h2>
      </div>

      <ol class="mt-10 grid gap-4 md:grid-cols-3">
        <!-- min-w-0: рядок імпорту в картці — truncate, але елемент сітки
             з типовим min-width: auto однаково розтягувався до повної довжини
             рядка, і головна на телефоні прокручувалася вбік на ~90px. -->
        <li v-for="(step, index) in steps" :key="step.title" class="relative flex min-w-0 flex-col rounded-overlay border border-line bg-card p-6 shadow-card">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-accent-solid text-sm font-semibold text-accent-contrast" aria-hidden="true">
            {{ index + 1 }}
          </span>
          <h3 class="mt-4 text-base font-semibold text-ink">{{ step.title }}</h3>
          <p class="mt-2 flex-1 text-sm leading-relaxed text-muted">{{ step.text }}</p>
          <div class="mt-4 flex items-center gap-2 rounded-card border border-line bg-subtle py-1.5 pl-3 pr-1.5">
            <code class="min-w-0 flex-1 truncate font-mono text-xs text-ink">{{ step.code }}</code>
            <UiCopyButton :text="step.code" size="sm" :aria-label="`Копіювати: ${step.code}`" />
          </div>
        </li>
      </ol>

      <div class="relative mt-16 overflow-hidden rounded-overlay border border-line bg-card px-6 py-10 shadow-overlay sm:px-10">
        <div class="home-cta-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div class="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 class="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Почніть з одного компонента</h2>
            <p class="mt-2 max-w-xl text-muted">
              Відкрийте API, скопіюйте файл разом із залежностями — і він ваш.
              Roadmap показує, що з'явиться далі й чому саме це.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <UiButton to="/docs/components/button" size="lg">Відкрити документацію</UiButton>
            <UiButton to="/docs/roadmap" variant="outline" size="lg">Roadmap</UiButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-cta-glow {
  background:
    radial-gradient(ellipse 50% 90% at 100% 0%, color-mix(in oklab, var(--accent-solid) 12%, transparent), transparent 70%),
    radial-gradient(ellipse 40% 80% at 0% 100%, color-mix(in oklab, var(--rating) 8%, transparent), transparent 70%);
}
</style>
