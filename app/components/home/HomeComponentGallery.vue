<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCard from '~/components/ui/UiCard.vue'
import UiCombobox, { type ComboboxOption } from '~/components/ui/UiCombobox.vue'
import UiCommandPalette from '~/components/ui/UiCommandPalette.vue'
import UiCopyButton from '~/components/ui/UiCopyButton.vue'
import UiFileUpload from '~/components/ui/UiFileUpload.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiModal from '~/components/ui/UiModal.vue'
import UiSelect, { type SelectOption } from '~/components/ui/UiSelect.vue'
import UiSkeleton from '~/components/ui/UiSkeleton.vue'
import UiStepper from '~/components/ui/UiStepper.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'
import { useToast } from '~/composables/useToast'

defineSlots<Record<string, never>>()

const toast = useToast()

const email = shallowRef('ihor@tatet.group')
const password = shallowRef('')
const plan = shallowRef<string | number | null>('pro')
const planOptions: SelectOption[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'team', label: 'Team' },
]

function submitAccount() {
  toast.success(`Налаштування ${email.value} збережено`, { title: 'Форма валідна' })
}

const allCities = ['Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро', 'Вінниця', 'Полтава']
const city = shallowRef<string | number | null>(null)
const cityOptions = ref<ComboboxOption[]>([])
const cityLoading = shallowRef(false)
let cityTimer: ReturnType<typeof setTimeout> | undefined

function searchCities(query: string) {
  if (cityTimer) clearTimeout(cityTimer)
  cityLoading.value = true
  cityTimer = setTimeout(() => {
    const needle = query.toLocaleLowerCase('uk')
    cityOptions.value = allCities
      .filter((name) => name.toLocaleLowerCase('uk').includes(needle))
      .map((name) => ({ value: name, label: name }))
    cityLoading.value = false
  }, 300)
}

const uploadProgress = shallowRef<number | null>(null)
const uploadedFile = shallowRef('—')
let uploadTimer: ReturnType<typeof setInterval> | undefined

function selectFiles(files: File[]) {
  if (uploadTimer) clearInterval(uploadTimer)
  uploadedFile.value = files[0]?.name ?? '—'
  uploadProgress.value = 0
  uploadTimer = setInterval(() => {
    uploadProgress.value = Math.min(100, (uploadProgress.value ?? 0) + 10)
    if (uploadProgress.value < 100) return
    if (uploadTimer) clearInterval(uploadTimer)
    uploadTimer = undefined
    toast.success(`«${uploadedFile.value}» завантажено`)
  }, 120)
}

const commandOpen = shallowRef(false)
const modalOpen = shallowRef(false)
const lastCommand = shallowRef('—')
const commandGroups = [
  {
    id: 'actions',
    label: 'Дії',
    items: [
      { id: 'preview', label: 'Відкрити modal', hint: 'Enter' },
      { id: 'publish', label: 'Опублікувати сторінку' },
    ],
  },
  {
    id: 'navigation',
    label: 'Навігація',
    items: [
      { id: 'docs', label: 'Документація' },
      { id: 'roadmap', label: 'Roadmap' },
    ],
  },
]

function selectCommand(payload: { groupId: string; item: string }) {
  const item = commandGroups
    .find((group) => group.id === payload.groupId)
    ?.items.find((entry) => entry.id === payload.item)
  lastCommand.value = item?.label ?? payload.item
  if (payload.item === 'preview') modalOpen.value = true
  else toast.info(`Команда: ${lastCommand.value}`)
}

const view = shallowRef<string | number>('list')
const step = shallowRef(0)
const activeTab = shallowRef('overview')

onBeforeUnmount(() => {
  if (cityTimer) clearTimeout(cityTimer)
  if (uploadTimer) clearInterval(uploadTimer)
})
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 pb-20">
    <h2 class="text-3xl font-semibold tracking-tight text-ink">Ще більше живих прикладів</h2>
    <p class="mt-2 max-w-2xl text-muted">
      Форми, async-дані, upload, command palette та складені стани можна перевірити прямо на сторінці.
    </p>

    <div class="mt-10 grid gap-4 md:grid-cols-2">
      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">Форма акаунта</h3></template>
        <form class="space-y-4" @submit.prevent="submitAccount">
          <UiInput v-model="email" name="email" type="email" label="Email" size="sm" required />
          <UiInput
            v-model="password"
            name="password"
            type="password"
            label="Новий пароль"
            placeholder="Щонайменше 8 символів"
            size="sm"
          />
          <UiSelect v-model="plan" name="plan" :options="planOptions" label="Тариф" size="sm" />
          <UiButton type="submit" size="sm">Зберегти форму</UiButton>
        </form>
      </UiCard>

      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">Async-пошук міста</h3></template>
        <UiCombobox
          v-model="city"
          :options="cityOptions"
          :loading="cityLoading"
          :min-chars="1"
          label="Місто"
          placeholder="Почніть набирати…"
          @search="searchCities"
        />
        <p class="mt-3 text-xs text-muted">Обрано: {{ city || '—' }}</p>
      </UiCard>

      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">File upload із прогресом</h3></template>
        <UiFileUpload
          accept="image/*,.pdf"
          :loading="uploadProgress != null && uploadProgress < 100"
          :progress="uploadProgress"
          hint="Зображення або PDF; upload тут симулюється локально."
          @select="selectFiles"
          @error="toast.error($event)"
        />
        <p class="mt-3 text-xs text-muted">Файл: {{ uploadedFile }}</p>
      </UiCard>

      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">Command palette та modal</h3></template>
        <div class="flex flex-wrap items-center gap-2">
          <UiButton size="sm" @click="commandOpen = true">Відкрити команди</UiButton>
          <span class="text-xs text-muted">або Ctrl/Cmd + K</span>
        </div>
        <p class="mt-3 text-xs text-muted">Остання команда: {{ lastCommand }}</p>
        <UiCommandPalette v-model="commandOpen" :groups="commandGroups" @select="selectCommand" />
      </UiCard>

      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">Навігаційні контроли</h3></template>
        <div class="space-y-5">
          <UiToggleGroup
            v-model="view"
            aria-label="Вигляд списку"
            block
            :options="[
              { value: 'list', label: 'Список' },
              { value: 'grid', label: 'Плитка' },
              { value: 'table', label: 'Таблиця' },
            ]"
          />
          <UiStepper
            v-model="step"
            click-mode="visited"
            :steps="[
              { id: 'connect', label: 'Підключення' },
              { id: 'fields', label: 'Поля' },
              { id: 'done', label: 'Готово' },
            ]"
          />
          <p class="text-xs text-muted">Вигляд: {{ view }}, крок: {{ step + 1 }}.</p>
        </div>
      </UiCard>

      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">Tabs і feedback</h3></template>
        <UiTabs
          v-model="activeTab"
          :tabs="[
            { id: 'overview', label: 'Огляд' },
            { id: 'team', label: 'Команда' },
            { id: 'archive', label: 'Архів', disabled: true },
          ]"
        >
          <template #panel-overview>
            <UiAlert tone="success" title="Усе синхронізовано">
              Поточна вкладка монтується ліниво, сусідні панелі не створюються.
            </UiAlert>
          </template>
          <template #panel-team>
            <div class="flex items-center gap-2">
              <UiAvatar name="Ігор Шевченко" :size="32" />
              <UiAvatar name="Марія Ковалишин" :size="32" tone="neutral" />
              <span class="text-sm text-muted">2 учасники онлайн</span>
            </div>
          </template>
        </UiTabs>
      </UiCard>
    </div>

    <div class="mt-4 grid gap-4 md:grid-cols-3">
      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">Skeleton</h3></template>
        <div class="space-y-2.5">
          <UiSkeleton class="h-4 w-3/4" />
          <UiSkeleton class="h-4 w-full" />
          <UiSkeleton class="h-4 w-5/6" />
        </div>
      </UiCard>
      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">Copy feedback</h3></template>
        <div class="flex items-center justify-between gap-2 rounded-control border border-line bg-subtle p-2">
          <code class="truncate text-xs text-ink">bun run typecheck</code>
          <UiCopyButton text="bun run typecheck" aria-label="Копіювати команду" />
        </div>
      </UiCard>
      <UiCard>
        <template #header><h3 class="text-sm font-semibold text-ink">Toast tones</h3></template>
        <div class="flex flex-wrap gap-2">
          <UiButton size="sm" variant="soft" @click="toast.success('Опубліковано')">Успіх</UiButton>
          <UiButton size="sm" variant="soft" @click="toast.warning('Квота на 90%')">Увага</UiButton>
          <UiButton size="sm" variant="danger" @click="toast.error('Не вдалося зберегти')">Помилка</UiButton>
        </div>
      </UiCard>
    </div>

    <UiModal v-model="modalOpen" title="Команда з палітри" size="sm">
      <p class="text-sm text-muted">
        Цей modal відкрився через вибір конкретного option у CommandPalette. Escape поверне фокус назад.
      </p>
      <template #footer>
        <UiButton @click="modalOpen = false">Зрозуміло</UiButton>
      </template>
    </UiModal>
  </section>
</template>
