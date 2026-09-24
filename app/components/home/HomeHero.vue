<script setup lang="ts">
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiAvatarGroup from '~/components/ui/UiAvatarGroup.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiIndicator from '~/components/ui/UiIndicator.vue'
import UiKbd from '~/components/ui/UiKbd.vue'
import UiProgressRing from '~/components/ui/UiProgressRing.vue'
import UiRating from '~/components/ui/UiRating.vue'
import UiSparkline from '~/components/ui/UiSparkline.vue'

defineSlots<Record<string, never>>()

/*
 * Два перші числа звіряє `bun run check:docs` з реальним вмістом
 * app/components/ui і content/docs: рукописне число застаріває мовчки,
 * щойно додали компонент. Формат запису рядків — саме такий, яким його
 * шукає перевірка.
 */
const stats = [
  { value: '72', label: 'компонентів' },
  { value: '71', label: 'сторінок документації' },
  { value: '0', label: 'runtime-залежностей', note: 'крім редактора на TipTap' },
  { value: 'AA', label: 'контраст у двох темах', note: 'перевіряється при кожній збірці' },
]

const highlights = ['Vue 3.5 · Nuxt 4', 'Tailwind v3 і v4', 'Світла й темна теми', 'Клавіатура й скрінрідери']

const team = [
  { id: 1, name: 'Олена Бондар' },
  { id: 2, name: 'Тарас Мельник' },
  { id: 3, name: 'Ірина Коваль' },
]

const revenue = [42, 48, 45, 53, 51, 60, 58, 66, 71, 69, 78, 84]
</script>

<template>
  <section class="home-hero relative isolate overflow-hidden">
    <!-- Декор: сітка точок і акцентне сяйво — лише токени, тож обидві теми
         отримують свій відтінок без окремих правил. -->
    <div class="home-hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
    <div class="home-hero-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem]" aria-hidden="true" />

    <div class="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-16 pt-12 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:pb-24">
      <div class="animate-fade-up">
        <NuxtLink
          to="/docs/roadmap"
          class="group inline-flex items-center gap-2 rounded-full border border-line bg-card/80 py-1 pl-1 pr-3 text-xs font-medium text-muted shadow-card backdrop-blur transition-colors hover:border-line-strong hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span class="rounded-full bg-accent-solid px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">Нове</span>
          Цикл 3 · десять компонентів із продуктів
          <svg class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </NuxtLink>

        <h1 class="mt-6 text-4xl font-semibold tracking-tight text-ink sm:text-5xl sm:leading-[1.08] lg:text-[3.35rem]">
          Інтерфейси, які
          <span class="home-hero-accent">копіюються</span>,
          а не встановлюються
        </h1>

        <p class="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Бібліотека компонентів для Vue і Nuxt, зібрана з продуктових кодових
          баз. Файл стає вашим після копіювання, а документація пояснює, від
          якого бага рятує кожне рішення в ньому.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <UiButton to="/docs" size="lg">
            Почати з документації
            <template #trailing>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </template>
          </UiButton>
          <UiButton to="/#examples" variant="outline" size="lg">Дивитися приклади</UiButton>
        </div>

        <ul class="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <li v-for="item in highlights" :key="item" class="flex items-center gap-1.5">
            <svg class="h-4 w-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 4.5 4.5L19 7" />
            </svg>
            {{ item }}
          </li>
        </ul>
      </div>

      <!--
        Композиція зі справжніх компонентів бібліотеки. Картки поруч з
        основною — декоративний шар (aria-hidden, без фокуса): на телефоні
        їх немає, а головну думку несе картка метрики.
      -->
      <div class="relative mx-auto w-full max-w-md pb-6 sm:pt-12 lg:max-w-none">
        <!-- Картки-супутники лягають на порожні кути основної: праву частину
             шапки й нижній край — жодна не накриває число чи підпис. -->
        <div
          class="absolute top-0 -right-3 z-20 hidden w-56 rotate-3 animate-fade-up rounded-card border border-line bg-card p-3 shadow-overlay sm:block"
          style="animation-delay: 160ms"
          aria-hidden="true"
          inert
        >
          <div class="flex gap-3">
            <img src="/demo/vase-terracotta.svg" alt="" class="h-14 w-14 shrink-0 rounded-control object-cover" />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-ink">Ваза «Теракота»</p>
              <UiRating :model-value="4.8" readonly size="sm" show-value :count="128" />
              <p class="mt-0.5 text-sm font-semibold tabular-nums text-ink">₴1 450</p>
            </div>
          </div>
        </div>

        <div class="relative z-10 animate-fade-up rounded-overlay border border-line bg-card shadow-overlay" style="animation-delay: 80ms">
          <div class="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <span class="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-ink">Виторг за вересень</h2>
          </div>

          <div class="px-5 pb-4 pt-5">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p class="text-4xl font-semibold tabular-nums tracking-tight text-ink">₴1 284 300</p>
              <UiChip tone="success" size="sm">
                <template #icon>
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </template>
                <span class="sr-only">зростання на </span>12,4 %
              </UiChip>
            </div>
            <p class="mt-1 text-sm text-muted">879 замовлень · середній чек ₴1 461</p>
            <UiSparkline
              class="mt-5"
              :data="revenue"
              variant="area"
              tone="accent"
              :height="84"
              :stroke-width="2.5"
              show-last-point
              label="Виторг за 12 тижнів: від 42 до 84 тисяч, стабільне зростання"
            />
          </div>

          <div class="grid grid-cols-3 divide-x divide-line border-t border-line">
            <div class="px-4 py-3">
              <p class="text-xs text-muted">Нових клієнтів</p>
              <p class="mt-0.5 text-lg font-semibold tabular-nums text-ink">87</p>
            </div>
            <div class="px-4 py-3">
              <p class="text-xs text-muted">Повернення</p>
              <p class="mt-0.5 text-lg font-semibold tabular-nums text-ink">2,1 %</p>
            </div>
            <div class="px-4 py-3">
              <p class="text-xs text-muted">Конверсія</p>
              <p class="mt-0.5 text-lg font-semibold tabular-nums text-ink">3,8 %</p>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 rounded-b-overlay border-t border-line bg-subtle px-5 py-3">
            <div class="flex items-center gap-3">
              <UiProgressRing :model-value="71" :size="36" :thickness="4" tone="success" label="План вересня виконано на 71 відсоток" />
              <div>
                <p class="text-sm font-medium text-ink">План місяця</p>
                <p class="text-xs text-muted">71 % · ₴516 тис. до мети</p>
              </div>
            </div>
            <UiAvatarGroup :items="team" :size="26" label="Команда продажів" />
          </div>
        </div>

        <div
          class="absolute -bottom-8 -left-8 z-20 hidden w-72 -rotate-2 animate-fade-up items-center gap-3 rounded-card border border-line bg-card p-3 shadow-overlay sm:flex"
          style="animation-delay: 240ms"
          aria-hidden="true"
          inert
        >
          <UiIndicator dot pulse tone="success" circular position="top-right">
            <UiAvatar name="Сігма Трейд" :size="36" />
          </UiIndicator>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-ink">Нове замовлення · ₴18 400</p>
            <p class="text-xs text-muted">ТОВ «Сігма Трейд» · щойно</p>
          </div>
        </div>

        <div
          class="absolute -bottom-6 right-4 z-0 hidden animate-fade-up items-center gap-2 rounded-full border border-line bg-card/90 py-1.5 pl-3 pr-1.5 text-xs text-muted shadow-raised backdrop-blur lg:flex"
          style="animation-delay: 320ms"
          aria-hidden="true"
        >
          Знайти компонент
          <UiKbd :combo="['Ctrl', 'K']" />
        </div>
      </div>
    </div>

    <div class="border-y border-line bg-card/60 backdrop-blur-sm">
      <dl class="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-9 sm:grid-cols-4">
        <!-- col-reverse: у DOM dt іде перед dd (так вимагає dl), а на екрані
             число стоїть над підписом; justify-end тримає числа на одній лінії. -->
        <div v-for="item in stats" :key="item.label" class="flex flex-col-reverse justify-end gap-1">
          <dt class="text-sm text-muted">
            {{ item.label }}
            <span v-if="item.note" class="block text-xs opacity-80">{{ item.note }}</span>
          </dt>
          <dd class="text-3xl font-semibold tabular-nums tracking-tight text-ink">{{ item.value }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
/*
 * Сітка точок — той самий прийом, що в сцені демо (ComponentPreview):
 * тло читається як «полотно» для компонентів, а не як порожнеча. Маска
 * гасить сітку донизу, щоб вона не сперечалась зі смугою статистики.
 */
.home-hero-grid {
  background-image: radial-gradient(color-mix(in oklab, var(--ink) 9%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 0%, #000 40%, transparent 100%);
}

.home-hero-glow {
  background:
    radial-gradient(ellipse 45% 55% at 78% 10%, color-mix(in oklab, var(--accent-solid) 16%, transparent), transparent 70%),
    radial-gradient(ellipse 35% 45% at 12% 0%, color-mix(in oklab, var(--rating) 10%, transparent), transparent 70%);
}

/*
 * Градієнт у словах — між двома акцентними токенами, обидва тримають
 * контраст великого тексту в своїй темі. Колір тексту під градієнтом —
 * запасний: без background-clip слово лишається просто акцентним.
 */
.home-hero-accent {
  color: var(--accent);
  background-image: linear-gradient(100deg, var(--accent) 10%, var(--accent-solid) 60%, var(--accent) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
