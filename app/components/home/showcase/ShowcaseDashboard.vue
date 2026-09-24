<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCard from '~/components/ui/UiCard.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
import UiProgressRing from '~/components/ui/UiProgressRing.vue'
import UiSparkline from '~/components/ui/UiSparkline.vue'
import UiStatCard from '~/components/ui/UiStatCard.vue'
import UiTimeline, { type TimelineItem } from '~/components/ui/UiTimeline.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'
import { useToast } from '~/composables/useToast'

defineSlots<Record<string, never>>()

type Period = '7d' | '30d' | '90d'

interface Metric {
  label: string
  value: string
  valueLabel?: string
  delta: number
  deltaFormat?: 'percent' | 'absolute'
  deltaGood?: 'up' | 'down'
  series: number[]
  variant: 'line' | 'area' | 'bar'
  tone: 'accent' | 'success' | 'danger' | 'neutral'
}

interface PeriodData {
  hint: string
  metrics: Metric[]
  goal: { done: number; target: number; label: string }
  categories: Array<{ name: string; value: number; share: number }>
}

/*
 * Дані трьох періодів — статичні, але узгоджені між собою: частки категорій
 * дають 100 %, план місяця сходиться з виторгом. Приклад, у якому числа не
 * б'ються, читається як макет, а не як продукт.
 */
const DATA: Record<Period, PeriodData> = {
  '7d': {
    hint: 'проти минулого тижня',
    metrics: [
      { label: 'Виторг', value: '₴312 400', valueLabel: '312 400 гривень', delta: 8.1, series: [38, 42, 40, 47, 45, 52, 56], variant: 'area', tone: 'success' },
      { label: 'Замовлення', value: '214', delta: 12, deltaFormat: 'absolute', series: [24, 31, 27, 35, 29, 33, 35], variant: 'bar', tone: 'accent' },
      { label: 'Середній чек', value: '₴1 460', valueLabel: '1460 гривень', delta: -2.3, series: [1510, 1490, 1502, 1470, 1455, 1468, 1460], variant: 'line', tone: 'neutral' },
      { label: 'Повернення', value: '1,8 %', delta: -0.4, deltaGood: 'down', series: [2.4, 2.2, 2.3, 2.0, 1.9, 1.9, 1.8], variant: 'line', tone: 'success' },
    ],
    goal: { done: 312, target: 420, label: 'План тижня' },
    categories: [
      { name: 'Вази', value: 118200, share: 38 },
      { name: 'Чашки й кухлі', value: 84300, share: 27 },
      { name: 'Миски', value: 56100, share: 18 },
      { name: 'Тарілки', value: 34400, share: 11 },
      { name: 'Декор', value: 19400, share: 6 },
    ],
  },
  '30d': {
    hint: 'проти серпня',
    metrics: [
      { label: 'Виторг', value: '₴1,28 млн', valueLabel: '1 284 300 гривень', delta: 12.4, series: [42, 48, 45, 53, 51, 60, 58, 66, 71, 69, 78, 84], variant: 'area', tone: 'success' },
      { label: 'Замовлення', value: '879', delta: 64, deltaFormat: 'absolute', series: [61, 72, 58, 80, 77, 85, 90, 74, 96, 88, 93, 101], variant: 'bar', tone: 'accent' },
      { label: 'Середній чек', value: '₴1 461', valueLabel: '1461 гривня', delta: 3.2, series: [1390, 1405, 1420, 1398, 1432, 1440, 1451, 1438, 1455, 1461], variant: 'line', tone: 'neutral' },
      { label: 'Повернення', value: '2,1 %', delta: 0.3, deltaGood: 'down', series: [1.7, 1.8, 1.8, 1.9, 2.0, 1.9, 2.1, 2.2, 2.1], variant: 'line', tone: 'danger' },
    ],
    goal: { done: 1284, target: 1800, label: 'План вересня' },
    categories: [
      { name: 'Вази', value: 462300, share: 36 },
      { name: 'Чашки й кухлі', value: 359600, share: 28 },
      { name: 'Миски', value: 218300, share: 17 },
      { name: 'Тарілки', value: 154100, share: 12 },
      { name: 'Декор', value: 90000, share: 7 },
    ],
  },
  '90d': {
    hint: 'проти попереднього кварталу',
    metrics: [
      { label: 'Виторг', value: '₴3,61 млн', valueLabel: '3 610 000 гривень', delta: 21.7, series: [2.1, 2.3, 2.2, 2.6, 2.8, 2.7, 3.0, 3.2, 3.61], variant: 'area', tone: 'success' },
      { label: 'Замовлення', value: '2 518', delta: 402, deltaFormat: 'absolute', series: [720, 790, 810, 760, 845, 880, 902, 870, 946], variant: 'bar', tone: 'accent' },
      { label: 'Середній чек', value: '₴1 434', valueLabel: '1434 гривні', delta: 5.9, series: [1340, 1362, 1375, 1390, 1402, 1410, 1426, 1434], variant: 'line', tone: 'neutral' },
      { label: 'Повернення', value: '1,9 %', delta: -0.6, deltaGood: 'down', series: [2.6, 2.5, 2.4, 2.3, 2.1, 2.0, 1.9], variant: 'line', tone: 'success' },
    ],
    goal: { done: 3610, target: 4800, label: 'План кварталу' },
    categories: [
      { name: 'Вази', value: 1263500, share: 35 },
      { name: 'Чашки й кухлі', value: 1047000, share: 29 },
      { name: 'Миски', value: 613700, share: 17 },
      { name: 'Тарілки', value: 433200, share: 12 },
      { name: 'Декор', value: 252600, share: 7 },
    ],
  },
}

const period = shallowRef<string | number>('30d')
const data = computed(() => DATA[period.value as Period])
const goalPercent = computed(() => Math.round((data.value.goal.done / data.value.goal.target) * 100))

const money = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

const orders = [
  { id: 'ЗМ-1042', client: 'Олена Бондар', total: 2890, status: 'paid' },
  { id: 'ЗМ-1041', client: 'Сігма Трейд', total: 18400, status: 'packing' },
  { id: 'ЗМ-1040', client: 'Тарас Мельник', total: 640, status: 'shipped' },
  { id: 'ЗМ-1039', client: 'Ірина Коваль', total: 1450, status: 'cancelled' },
] as const

const STATUS = {
  paid: { tone: 'success', label: 'Оплачено' },
  packing: { tone: 'warning', label: 'Пакується' },
  shipped: { tone: 'info', label: 'Відправлено' },
  cancelled: { tone: 'neutral', label: 'Скасовано' },
} as const

const activity: TimelineItem[] = [
  { id: 1, title: 'Оптове замовлення на ₴18 400', description: 'ТОВ «Сігма Трейд» · 24 вази', time: '10:42', tone: 'success' },
  { id: 2, title: 'Новий відгук ★★★★★', description: 'Чашка «Вершки»', time: '09:15', tone: 'accent' },
  { id: 3, title: 'Залишок нижче мінімуму', description: 'Миска «Шавлія» — 3 шт.', time: '08:03', tone: 'warning' },
  { id: 4, title: 'Повернення оформлено', description: 'ЗМ-1027 · тріснула ручка', time: 'вчора', tone: 'danger' },
]

const toast = useToast()
const exporting = shallowRef(false)
let exportTimer: ReturnType<typeof setTimeout> | undefined

function exportReport() {
  exporting.value = true
  // Затримка імітує запит — видно loading кнопки, що зберігає ширину.
  exportTimer = setTimeout(() => {
    exporting.value = false
    toast.success('Звіт за період готовий до завантаження', {
      title: 'Експорт завершено',
      actions: [{ label: 'Завантажити CSV', onClick: () => toast.info('Демо: файл не створюється') }],
      duration: 6000,
    })
  }, 1200)
}

// Вкладку вітрини можуть перемкнути посеред «запиту» — таймер не має
// показати тост від екрана, якого вже немає.
onBeforeUnmount(() => clearTimeout(exportTimer))
</script>

<template>
  <div class="space-y-5 p-4 sm:p-6">
    <UiPageHeader
      title="Огляд продажів"
      description="Майстерня «Глина» · дані оновлено щойно"
      as="h3"
      size="md"
    >
      <template #actions>
        <UiToggleGroup
          v-model="period"
          size="sm"
          aria-label="Період"
          :options="[
            { value: '7d', label: '7 днів' },
            { value: '30d', label: '30 днів' },
            { value: '90d', label: 'Квартал' },
          ]"
        />
        <UiButton variant="outline" size="sm" :loading="exporting" @click="exportReport">
          <template #leading>
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
            </svg>
          </template>
          Експорт
        </UiButton>
      </template>
    </UiPageHeader>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <UiStatCard
        v-for="metric in data.metrics"
        :key="metric.label"
        size="sm"
        :label="metric.label"
        :value="metric.value"
        :value-label="metric.valueLabel"
        :delta="metric.delta"
        :delta-format="metric.deltaFormat ?? 'percent'"
        :delta-good="metric.deltaGood ?? 'up'"
        :hint="data.hint"
      >
        <template #trend>
          <UiSparkline :data="metric.series" :variant="metric.variant" :tone="metric.tone" :height="36" />
        </template>
      </UiStatCard>
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <UiCard>
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-sm font-semibold text-ink">Продажі за категоріями</h4>
            <span class="text-xs text-muted">частка виторгу</span>
          </div>
        </template>
        <ul class="space-y-3.5">
          <li v-for="category in data.categories" :key="category.name">
            <div class="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span class="text-ink">{{ category.name }}</span>
              <span class="tabular-nums text-muted">
                ₴{{ money.format(category.value) }}
                <span class="ml-1.5 inline-block w-9 text-right font-medium text-ink">{{ category.share }}%</span>
              </span>
            </div>
            <!-- Частка — це дані, а не перебіг процесу: role="progressbar"
                 тут збрехав би скрінрідеру. Число вже є текстом у рядку
                 вище, тож смуга лише декоративна. -->
            <div class="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div
                class="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow) ease-out"
                :style="{ width: `${(category.share / 40) * 100}%` }"
              />
            </div>
          </li>
        </ul>
      </UiCard>

      <UiCard>
        <template #header>
          <h4 class="text-sm font-semibold text-ink">{{ data.goal.label }}</h4>
        </template>
        <div class="flex items-center gap-5">
          <UiProgressRing
            :model-value="goalPercent"
            :size="104"
            :thickness="10"
            :tone="goalPercent >= 100 ? 'success' : 'accent'"
            show-value
            :label="`${data.goal.label}: виконано ${goalPercent} відсотків`"
          />
          <div class="min-w-0 space-y-1">
            <p class="text-2xl font-semibold tabular-nums tracking-tight text-ink">
              ₴{{ money.format(data.goal.done) }} тис.
            </p>
            <p class="text-sm text-muted">з ₴{{ money.format(data.goal.target) }} тис.</p>
            <UiChip :tone="goalPercent >= 70 ? 'success' : 'warning'" dot size="sm">
              {{ goalPercent >= 70 ? 'Йдемо за планом' : 'Потрібне прискорення' }}
            </UiChip>
          </div>
        </div>
        <dl class="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
          <div>
            <dt class="text-muted">До мети</dt>
            <dd class="mt-0.5 font-medium tabular-nums text-ink">₴{{ money.format(data.goal.target - data.goal.done) }} тис.</dd>
          </div>
          <div>
            <dt class="text-muted">Найкраща категорія</dt>
            <dd class="mt-0.5 font-medium text-ink">{{ data.categories[0]!.name }}</dd>
          </div>
        </dl>
        <UiButton variant="link" size="sm" class="mt-3" @click="toast.info('Демо: тут відкрилося б редагування плану')">
          Змінити план
        </UiButton>
      </UiCard>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <UiCard padding="none">
        <template #header>
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold text-ink">Останні замовлення</h4>
            <UiButton variant="link" size="sm" @click="toast.info('Демо: відкрилась би сторінка замовлень')">Усі замовлення</UiButton>
          </div>
        </template>
        <ul class="divide-y divide-line">
          <li v-for="order in orders" :key="order.id" class="flex items-center gap-3 px-4 py-3 sm:px-5">
            <UiAvatar :name="order.client" :size="32" :tone="order.client === 'Сігма Трейд' ? 'neutral' : 'primary'" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-ink">{{ order.client }}</p>
              <p class="text-xs text-muted">{{ order.id }}</p>
            </div>
            <UiChip :tone="STATUS[order.status].tone" dot>{{ STATUS[order.status].label }}</UiChip>
            <span class="w-20 text-right text-sm font-medium tabular-nums text-ink">₴{{ money.format(order.total) }}</span>
          </li>
        </ul>
      </UiCard>

      <UiCard>
        <template #header>
          <h4 class="text-sm font-semibold text-ink">Активність</h4>
        </template>
        <UiTimeline :items="activity" density="sm" />
      </UiCard>
    </div>
  </div>
</template>
