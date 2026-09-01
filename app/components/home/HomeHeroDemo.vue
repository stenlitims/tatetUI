<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCard from '~/components/ui/UiCard.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiKbd from '~/components/ui/UiKbd.vue'
import UiProgress from '~/components/ui/UiProgress.vue'
import UiSelect, { type SelectOption } from '~/components/ui/UiSelect.vue'
import UiSwitch from '~/components/ui/UiSwitch.vue'
import { useTheme } from '~/composables/useTheme'
import { useToast } from '~/composables/useToast'

defineSlots<Record<string, never>>()

const INITIAL_SPACE = 'tatet'
const INITIAL_DESTINATION = 'sales'

const space = shallowRef(INITIAL_SPACE)
const destination = shallowRef<string | number | null>(INITIAL_DESTINATION)
const { isDark, toggle } = useTheme()
const toast = useToast()

const groupOptions: SelectOption[] = [
  { value: 'sales', label: 'Продажі' },
  { value: 'support', label: 'Підтримка' },
  { value: 'analytics', label: 'Аналітика' },
  { value: 'archive', label: 'Архів' },
]

const themeHint = computed(() => (isDark.value ? 'Темна тема' : 'Світла тема'))

const features = [
  {
    title: 'Копіюй, не встановлюй',
    text: 'Компонент стає частиною проєкту після копіювання. 60 із 61 UI-файлу не мають runtime-залежностей.',
  },
  {
    title: 'Токени замість кольорів',
    text: 'bg-card замість сирих кольорів. Та сама розмітка працює у світлій і темній темах.',
  },
  {
    title: 'Доступність — контракт',
    text: 'ARIA, клавіатура, видимий фокус і 44px touch targets перевіряються разом із поведінкою.',
  },
  {
    title: 'Оверлеї працюють разом',
    text: 'Modal, Drawer, ConfirmDialog, dropdown і toast поділяють передбачувані focus та layer правила.',
  },
]

const stats = [
  { value: '61', label: 'UI-файлів' },
  { value: '60', label: 'публічних сторінок' },
  { value: 'AA', label: 'мінімальний контраст' },
  { value: '1', label: 'TipTap-виняток' },
]

function resetSettings() {
  space.value = INITIAL_SPACE
  destination.value = INITIAL_DESTINATION
  toast.info('Налаштування повернуто до початкових')
}

function saveSettings() {
  toast.success(`Простір «${space.value || 'Без назви'}» збережено`, {
    title: 'Готово',
  })
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:pt-28">
    <div class="grid items-center gap-12 lg:grid-cols-2">
      <div>
        <span class="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-accent">
          <span class="h-1.5 w-1.5 rounded-full bg-accent-solid" aria-hidden="true" />
          Канонічна бібліотека для проєктів tatet
        </span>

        <h1 class="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-5xl sm:leading-[1.1]">
          UI-компоненти, які <span class="text-accent">копіюються</span>, а не встановлюються
        </h1>

        <p class="mt-5 max-w-xl text-lg text-muted">
          Зібрано з кількох продуктових кодових баз, де ті самі компоненти
          писали незалежно по кілька разів. Нижче — не скріншоти, а робочі
          сценарії на компонентах бібліотеки.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <UiButton to="/docs" size="lg">Документація</UiButton>
          <UiButton to="/docs/roadmap" variant="outline" size="lg">Roadmap</UiButton>
        </div>

        <p class="mt-5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          Тема змінюється тут і в документації одночасно — <UiKbd combo="T" /> не потрібен
        </p>
      </div>

      <UiCard padding="none" class="w-full max-w-md justify-self-center shadow-overlay">
        <div class="border-b border-line px-5 py-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-ink">Налаштування простору</h2>
            <UiChip tone="success" dot label="Синхронізовано">live</UiChip>
          </div>
        </div>

        <form class="flex flex-col gap-4 p-5" @submit.prevent="saveSettings">
          <UiInput v-model="space" name="space" label="Назва простору" size="sm" />
          <UiSelect
            v-model="destination"
            name="destination"
            :options="groupOptions"
            label="Проєкт за замовчуванням"
            size="sm"
          />
          <div class="flex items-center justify-between rounded-card border border-line bg-subtle px-3.5 py-3">
            <span class="text-sm text-ink">Тема: {{ themeHint }}</span>
            <UiSwitch :model-value="isDark" label="Перемкнути тему" @update:model-value="toggle()" />
          </div>
          <UiProgress :model-value="72" label="Заповнення сховища" show-value />
          <div class="flex justify-end gap-2 border-t border-line pt-4">
            <UiButton type="button" variant="ghost" size="sm" @click="resetSettings">
              Скасувати
            </UiButton>
            <UiButton type="submit" size="sm">Зберегти</UiButton>
          </div>
        </form>
      </UiCard>
    </div>
  </section>

  <section class="border-y border-line bg-subtle">
    <dl class="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
      <div v-for="item in stats" :key="item.label">
        <dt class="text-xs uppercase tracking-wide text-muted">{{ item.label }}</dt>
        <dd class="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-ink">
          {{ item.value }}
        </dd>
      </div>
    </dl>
  </section>

  <section class="mx-auto max-w-6xl px-4 py-20">
    <h2 class="text-3xl font-semibold tracking-tight text-ink">Чому саме так</h2>
    <p class="mt-2 max-w-2xl text-muted">
      Кожне правило закриває клас помилок, який уже траплявся у продуктових інтерфейсах.
    </p>
    <div class="mt-10 grid gap-4 sm:grid-cols-2">
      <UiCard v-for="feature in features" :key="feature.title">
        <h3 class="text-sm font-semibold text-ink">{{ feature.title }}</h3>
        <p class="mt-2 text-sm leading-relaxed text-muted">{{ feature.text }}</p>
      </UiCard>
    </div>
  </section>
</template>
