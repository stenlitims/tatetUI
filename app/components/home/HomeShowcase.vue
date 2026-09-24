<script setup lang="ts">
import { computed, defineAsyncComponent, shallowRef, type Component } from 'vue'
import HomeWindow from '~/components/home/HomeWindow.vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiSkeleton from '~/components/ui/UiSkeleton.vue'
import UiTabs, { type TabItem } from '~/components/ui/UiTabs.vue'

defineSlots<Record<string, never>>()

interface Scenario {
  id: string
  label: string
  icon: string
  url: string
  title: string
  text: string
  tries: string[]
  components: string[]
  admin: boolean
}

/*
 * Кожен екран — окремий чанк. Прередер рендерить лише активний (дашборд),
 * решта вантажиться, коли на вкладку клацнули: вітрина з п'яти екранів не
 * має важити як п'ять екранів на першому завантаженні головної. Поки чанк
 * їде, <Suspense> нижче показує скелетон тієї самої висоти.
 */
const SCREENS: Record<string, Component> = {
  dashboard: defineAsyncComponent(() => import('~/components/home/showcase/ShowcaseDashboard.vue')),
  data: defineAsyncComponent(() => import('~/components/home/showcase/ShowcaseData.vue')),
  crm: defineAsyncComponent(() => import('~/components/home/showcase/ShowcaseCrm.vue')),
  shop: defineAsyncComponent(() => import('~/components/home/showcase/ShowcaseShop.vue')),
  settings: defineAsyncComponent(() => import('~/components/home/showcase/ShowcaseSettings.vue')),
}

const scenarios: Scenario[] = [
  {
    id: 'dashboard',
    label: 'Дашборд',
    icon: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z',
    url: 'admin.glyna.ua/overview',
    title: 'Дашборд продажів',
    text: 'Метрики з трендом, план місяця й стрічка подій. Числа узгоджені між собою, як у справжньому звіті, а не в макеті.',
    tries: ['Перемкніть період — оновляться цифри й спарклайни', 'Натисніть «Експорт»: кнопка тримає ширину, тост має дію'],
    components: ['PageHeader', 'ToggleGroup', 'StatCard', 'Sparkline', 'ProgressRing', 'Timeline', 'Avatar', 'Chip', 'Toast'],
    admin: true,
  },
  {
    id: 'data',
    label: 'Таблиця',
    icon: 'M3 5h18v14H3zM3 10h18M9 10v9',
    url: 'admin.glyna.ua/pages',
    title: 'Список із масовими діями',
    text: 'Пошук, фільтр за статусами, сортування, вибір рядків і редагування в бічній панелі — один потік без перезавантажень.',
    tries: ['Оберіть кілька рядків — з’являться масові дії', 'Видаліть сторінки й поверніть їх кнопкою в тості', 'Клацніть рядок, щоб редагувати його в Drawer'],
    components: ['Table', 'Input', 'MultiSelect', 'Pagination', 'Drawer', 'ConfirmDialog', 'EmptyState', 'Textarea', 'Switch'],
    admin: true,
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    url: 'crm.glyna.ua/clients/sigma',
    title: 'Картка клієнта',
    text: 'Шапка запису з діями, реквізити з редагуванням на місці, воронка, стрічка активності, угоди у бічній панелі й файли.',
    tries: ['Клацніть відповідального, щоб змінити його на місці', 'Додайте нотатку — вона з’явиться в стрічці', 'У «Файлах» оберіть кілька — внизу з’явиться панель дій'],
    components: ['PageHeader', 'Breadcrumb', 'ButtonGroup', 'SplitButton', 'Tabs', 'DescriptionList', 'InlineEdit', 'TagInput', 'Stepper', 'Timeline', 'FileUpload', 'ActionBar', 'Drawer'],
    admin: true,
  },
  {
    id: 'shop',
    label: 'Магазин',
    icon: 'M6 7h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.6L5 4H2M9.5 20.5h.01M17.5 20.5h.01',
    url: 'glyna.ua/vazy/terakota',
    title: 'Сторінка товару',
    text: 'Галерея зі свайпом і повноекранним переглядом, варіанти, кошик із лічильником і відгуки з оцінкою.',
    tries: ['Клацніть фото — відкриється лайтбокс зі збільшенням', 'Змініть поливу: зміняться фото, ціна й залишок', 'Надішліть відгук без оцінки — форма не пропустить'],
    components: ['Carousel', 'Lightbox', 'Rating', 'ToggleGroup', 'FormField', 'NumberInput', 'Indicator', 'Accordion', 'Alert'],
    admin: false,
  },
  {
    id: 'settings',
    label: 'Налаштування',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    url: 'admin.glyna.ua/settings',
    title: 'Налаштування акаунта',
    text: 'Форма з перевіркою після спроби зберегти, налаштування, що діють одразу, двофакторний вхід і панель незбережених змін.',
    tries: ['Змініть будь-що — з’явиться «Незбережені зміни»', 'Зітріть email і збережіть — побачите помилки', 'Увімкніть 2FA й введіть код (000000 — помилка)'],
    components: ['FormField', 'Input', 'Textarea', 'Select', 'ToggleGroup', 'Switch', 'InputOtp', 'RadioGroup', 'ActionBar', 'Alert'],
    admin: true,
  },
]

const tabs: TabItem[] = scenarios.map(({ id, label }) => ({ id, label }))
const active = shallowRef('dashboard')
const scenario = computed(() => scenarios.find((item) => item.id === active.value) ?? scenarios[0]!)

/** PageHeader → /docs/components/page-header */
const docsRoute = (name: string) =>
  `/docs/components/${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
</script>

<template>
  <section id="examples" class="scroll-mt-16 border-y border-line bg-subtle py-20 sm:py-24" aria-labelledby="examples-title">
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold text-accent">Приклади використання</p>
        <h2 id="examples-title" class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Реальні екрани, зібрані лише з бібліотеки
        </h2>
        <p class="mt-3 text-lg text-muted">
          Не скріншоти: фільтруйте, редагуйте, відкривайте оверлеї, перемикайте
          тему. Кожен екран — звичайний Vue-файл із тих самих компонентів, що
          описані в документації.
        </p>
      </div>

      <!-- query-param: на конкретний екран можна дати посилання — /?example=crm. -->
      <UiTabs v-model="active" :tabs="tabs" variant="pills" query-param="example" aria-label="Приклади екранів" class="mt-10">
        <template v-for="item in scenarios" #[`tab-${item.id}`]>
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="item.icon" />
          </svg>
          {{ item.label }}
        </template>

        <div class="mt-2 grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 class="text-lg font-semibold text-ink">{{ scenario.title }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-muted">{{ scenario.text }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">Спробуйте</p>
            <ul class="mt-2 space-y-1.5">
              <li v-for="hint in scenario.tries" :key="hint" class="flex gap-2 text-sm text-ink">
                <svg class="mt-0.5 h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m9 11 3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                {{ hint }}
              </li>
            </ul>
          </div>
        </div>

        <HomeWindow :url="scenario.url" class="mt-6">
          <template v-if="scenario.admin" #toolbar>
            <UiAvatar name="Олена Бондар" :size="24" status="online" />
          </template>
          <Suspense>
            <component :is="SCREENS[active]" />
            <!--
              Скелетон заввишки з типовий екран: поки чанк їде мережею,
              сторінка під вітриною не стрибає. Сам екран висоти не тримає —
              інакше під коротшими екранами лишалась би порожнеча.
            -->
            <template #fallback>
              <div class="h-[40rem] space-y-4 p-6" aria-busy="true" aria-label="Екран завантажується">
                <UiSkeleton class="h-7 w-64" />
                <UiSkeleton class="h-4 w-96 max-w-full" />
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <UiSkeleton v-for="n in 4" :key="n" class="h-28 w-full" rounded="card" />
                </div>
                <UiSkeleton class="h-64 w-full" rounded="card" />
              </div>
            </template>
          </Suspense>
        </HomeWindow>

        <div class="mt-5 flex flex-wrap items-center gap-2">
          <span class="mr-1 text-sm text-muted">Зібрано з:</span>
          <NuxtLink
            v-for="name in scenario.components"
            :key="name"
            :to="docsRoute(name)"
            class="rounded-full border border-line bg-card px-2.5 py-1 font-mono text-xs text-ink transition-colors hover:border-accent-solid hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {{ name }}
          </NuxtLink>
        </div>
      </UiTabs>
    </div>
  </section>
</template>
