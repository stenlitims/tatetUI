<script setup lang="ts">
import { docsNav } from '~/config/docsNav'

defineSlots<Record<string, never>>()

/*
 * Каталог будується з того самого docsNav, що й сайдбар документації, а
 * не з окремого списку: розбіжність між ними ловить check:docs лише для
 * сайдбару, тож другий рукописний список застарів би першим.
 */
const META: Record<string, { text: string; icon: string }> = {
  'Дії': { text: 'Кнопки, чипи й панель масових дій', icon: 'M15 15l6 6M9.5 16a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z' },
  'Форми': { text: 'Поля, вибір, дати, оцінка', icon: 'M4 6h16M4 12h10M4 18h7' },
  'Оверлеї': { text: 'Вікна, панелі, меню, тости, галерея', icon: 'M8 8h12v12H8zM4 16V4h12' },
  'Дані': { text: 'Таблиці, дерева, метрики, стрічки', icon: 'M3 5h18v14H3zM3 10h18M9 10v9' },
  'Структура': { text: 'Навігація, вкладки, панелі, розкладка', icon: 'M3 4h18v16H3zM9 4v16' },
  'Стани': { text: 'Завантаження, порожнеча, прогрес', icon: 'M12 3a9 9 0 1 0 9 9' },
  'Дрібниці': { text: 'Клавіші, лічильники, копіювання, команди', icon: 'M4 7h4v4H4zM10 7h4v4h-4zM16 7h4v4h-4zM7 13h10v4H7z' },
  'Контент': { text: 'Типографіка й редактор', icon: 'M5 5h14M5 10h14M5 15h9M5 20h6' },
}

const groups = docsNav
  .filter((group) => group.title in META)
  .map((group) => ({ ...group, ...META[group.title]! }))

const total = groups.reduce((sum, group) => sum + group.items.length, 0)

// Число в заголовку змінюється з кожним компонентом — відмінок теж мусить.
const PAGE_FORMS: Record<string, string> = { one: 'сторінка', few: 'сторінки', many: 'сторінок', other: 'сторінки' }
const pageWord = PAGE_FORMS[new Intl.PluralRules('uk-UA').select(total)]
</script>

<template>
  <section class="py-20 sm:py-24" aria-labelledby="catalog-title">
    <div class="mx-auto max-w-6xl px-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold text-accent">Каталог</p>
          <h2 id="catalog-title" class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {{ total }} {{ pageWord }} компонентів, згрупованих за роллю
          </h2>
          <p class="mt-3 text-lg text-muted">
            Кожна сторінка — живий приклад, таблиця API з коду, «коли використовувати»
            і «коли ні», а також список файлів, які треба скопіювати разом.
            Крапкою позначено нове в третьому циклі.
          </p>
        </div>
      </div>

      <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article
          v-for="group in groups"
          :key="group.title"
          class="group/card flex flex-col rounded-card border border-line bg-card p-5 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-control bg-primary-50 text-accent">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path :d="group.icon" />
              </svg>
            </span>
            <span class="rounded-full bg-hover px-2 py-0.5 text-xs font-medium tabular-nums text-muted">{{ group.items.length }}</span>
          </div>
          <h3 class="mt-4 text-base font-semibold text-ink">{{ group.title }}</h3>
          <p class="mt-1 text-sm text-muted">{{ group.text }}</p>
          <ul class="mt-4 flex flex-wrap gap-1.5">
            <li v-for="item in group.items" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-sm text-ink transition-colors hover:bg-hover hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {{ item.title }}
                <span v-if="item.status === 'wip'" class="rounded bg-warning-bg px-1 text-[10px] font-medium text-warning">wip</span>
                <span v-else-if="item.fresh" class="h-1.5 w-1.5 rounded-full bg-accent-solid" aria-hidden="true" />
                <span v-if="item.fresh" class="sr-only">(нове)</span>
              </NuxtLink>
            </li>
          </ul>
        </article>
      </div>
    </div>
  </section>
</template>
