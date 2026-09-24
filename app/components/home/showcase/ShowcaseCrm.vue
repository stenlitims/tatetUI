<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import UiActionBar from '~/components/ui/UiActionBar.vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiAvatarGroup from '~/components/ui/UiAvatarGroup.vue'
import UiBreadcrumb from '~/components/ui/UiBreadcrumb.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiButtonGroup from '~/components/ui/UiButtonGroup.vue'
import UiCard from '~/components/ui/UiCard.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiCopyButton from '~/components/ui/UiCopyButton.vue'
import UiDescriptionList from '~/components/ui/UiDescriptionList.vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import UiFileUpload from '~/components/ui/UiFileUpload.vue'
import UiInlineEdit from '~/components/ui/UiInlineEdit.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
import UiSplitButton from '~/components/ui/UiSplitButton.vue'
import UiSpinner from '~/components/ui/UiSpinner.vue'
import UiStepper from '~/components/ui/UiStepper.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiTagInput from '~/components/ui/UiTagInput.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import UiTimeline, { type TimelineItem } from '~/components/ui/UiTimeline.vue'
import { useConfirm } from '~/composables/useConfirm'
import { useToast } from '~/composables/useToast'

defineSlots<Record<string, never>>()

const toast = useToast()
const { confirm } = useConfirm()

const tab = shallowRef('overview')

const team = [
  { id: 1, name: 'Олена Бондар' },
  { id: 2, name: 'Тарас Мельник' },
  { id: 3, name: 'Ірина Коваль' },
  { id: 4, name: 'Андрій Лисенко' },
]

/* ------------------------------------------------------------------ */
/*  Огляд                                                              */
/* ------------------------------------------------------------------ */

const manager = shallowRef<string | number | null>('Олена Бондар')
const phone = shallowRef<string | number | null>('+380 67 123 45 67')
const tags = ref<string[]>(['опт', 'кав’ярні', 'постійний'])
const stage = shallowRef(2)
const stages = [
  { id: 'lead', label: 'Контакт' },
  { id: 'offer', label: 'Пропозиція' },
  { id: 'talks', label: 'Переговори' },
  { id: 'deal', label: 'Угода' },
]

const details = computed(() => [
  { key: 'edrpou', term: 'ЄДРПОУ', value: '41234567' },
  { key: 'segment', term: 'Сегмент', value: 'HoReCa, опт' },
  { key: 'email', term: 'Email', value: 'orders@sigma.ua' },
  { key: 'address', term: 'Адреса', value: 'Київ, вул. Кирилівська, 41', wide: true },
])

const note = shallowRef('')
const activity = ref<TimelineItem[]>([
  { id: 1, title: 'Надіслано комерційну пропозицію', description: '24 вази «Теракота» · ₴34 800', time: 'сьогодні, 10:42', tone: 'accent' },
  { id: 2, title: 'Дзвінок: погодили терміни', description: 'Доставка до 10 жовтня', time: 'вчора, 16:20', tone: 'success' },
  { id: 3, title: 'Клієнт відкрив рахунок', time: '19 вер., 09:12', tone: 'info' },
])

function addNote() {
  const text = note.value.trim()
  if (!text) return
  activity.value.unshift({ id: Date.now(), title: 'Нотатка', description: text, time: 'щойно', tone: 'neutral' })
  note.value = ''
  toast.success('Нотатку додано до стрічки')
}

function onManagerSave(value: string | number | null) {
  toast.success(`Відповідального змінено: ${value}`)
}

/* ------------------------------------------------------------------ */
/*  Угоди                                                              */
/* ------------------------------------------------------------------ */

interface Deal {
  id: number
  title: string
  amount: number
  stage: number
  due: string
}

const deals = ref<Deal[]>([
  { id: 1, title: 'Осіння партія ваз', amount: 34800, stage: 2, due: '10 жовт.' },
  { id: 2, title: 'Посуд для нової кав’ярні', amount: 58200, stage: 1, due: '1 лист.' },
  { id: 3, title: 'Сувеніри до свят', amount: 21400, stage: 0, due: '15 груд.' },
  { id: 4, title: 'Літня колекція', amount: 42600, stage: 3, due: 'закрито' },
])

const money = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const openDeal = shallowRef<Deal | null>(null)
const dealOpen = shallowRef(false)

function showDeal(deal: Deal) {
  openDeal.value = deal
  dealOpen.value = true
}

function stageTone(index: number) {
  return index === 3 ? 'success' : index === 2 ? 'warning' : 'info'
}

async function markWon() {
  const deal = openDeal.value
  if (!deal) return
  const accepted = await confirm({
    title: 'Позначити угоду виграною?',
    message: `«${deal.title}» перейде в закриті, а сума ₴${money.format(deal.amount)} потрапить у план місяця.`,
    confirmText: 'Так, виграно',
  })
  if (!accepted) return
  deal.stage = 3
  deal.due = 'закрито'
  dealOpen.value = false
  toast.success(`Угоду «${deal.title}» виграно`)
}

/* ------------------------------------------------------------------ */
/*  Файли                                                              */
/* ------------------------------------------------------------------ */

interface FileRow {
  id: number
  name: string
  size: string
  uploading?: boolean
}

const files = ref<FileRow[]>([
  { id: 1, name: 'Договір поставки 2026.pdf', size: '412 КБ' },
  { id: 2, name: 'Рахунок №1042.pdf', size: '96 КБ' },
  { id: 3, name: 'Прайс опт — вересень.xlsx', size: '58 КБ' },
  { id: 4, name: 'Фото вітрини.jpg', size: '2,1 МБ' },
])
const selectedFiles = ref<number[]>([])

function toggleFile(id: number, value: boolean) {
  selectedFiles.value = value ? [...selectedFiles.value, id] : selectedFiles.value.filter((item) => item !== id)
}

function addFiles(list: File[]) {
  for (const file of list) {
    const row: FileRow = {
      id: Date.now() + Math.random(),
      name: file.name,
      size: `${Math.max(1, Math.round(file.size / 1024))} КБ`,
      uploading: true,
    }
    files.value.unshift(row)
    // Завантаження імітується — видно спінер у рядку замість розміру.
    setTimeout(() => {
      const target = files.value.find((item) => item.id === row.id)
      if (target) target.uploading = false
    }, 1400)
  }
}

async function removeFiles() {
  const count = selectedFiles.value.length
  const accepted = await confirm({
    title: `Видалити файли (${count})?`,
    message: 'Файли зникнуть із картки клієнта для всієї команди.',
    confirmText: 'Видалити',
    danger: true,
  })
  if (!accepted) return
  files.value = files.value.filter((file) => !selectedFiles.value.includes(file.id))
  selectedFiles.value = []
  toast.success(`Видалено файлів: ${count}`)
}

const splitItems = [
  { id: 'task', label: 'Задача', description: 'Нагадування команді' },
  { id: 'call', label: 'Дзвінок', description: 'Запланувати на календарі' },
  { id: 'note', label: 'Нотатка' },
]
</script>

<template>
  <div class="space-y-5 p-4 sm:p-6">
    <UiPageHeader
      title="ТОВ «Сігма Трейд»"
      description="Оптовий покупець кераміки для кав’ярень · Київ"
      as="h3"
    >
      <template #breadcrumb>
        <UiBreadcrumb :items="[{ label: 'CRM' }, { label: 'Клієнти' }, { label: 'Сігма Трейд' }]" aria-label="Шлях до клієнта" />
      </template>
      <template #leading>
        <UiAvatar name="Сігма Трейд" :size="48" />
      </template>
      <template #meta>
        <UiChip tone="success" dot size="sm">Активний</UiChip>
        <span>Клієнт з березня 2024</span>
        <UiAvatarGroup :items="team" :max="3" :size="24" label="Команда клієнта" />
      </template>
      <template #actions>
        <UiButtonGroup label="Перехід між клієнтами">
          <UiButton variant="outline" size="icon" label="Попередній клієнт" @click="toast.info('Демо: відкрилась би картка попереднього клієнта')">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </UiButton>
          <UiButton variant="outline" size="icon" label="Наступний клієнт" @click="toast.info('Демо: відкрилась би картка наступного клієнта')">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </UiButton>
        </UiButtonGroup>
        <UiButton variant="outline" @click="toast.info('Демо: відкрився б лист клієнту')">Написати</UiButton>
        <UiSplitButton
          label="Нова угода"
          :items="splitItems"
          menu-label="Інші дії"
          @click="toast.success('Чернетку угоди створено')"
          @select="(item) => toast.info(`Створено: ${item.label.toLowerCase()}`)"
        />
      </template>

    </UiPageHeader>

    <UiTabs
      v-model="tab"
      :tabs="[
        { id: 'overview', label: 'Огляд' },
        { id: 'deals', label: `Угоди · ${deals.length}` },
        { id: 'files', label: `Файли · ${files.length}` },
      ]"
      aria-label="Розділи картки клієнта"
    >
      <template #panel-overview>
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div class="space-y-4">
            <UiCard>
              <template #header>
                <h4 class="text-sm font-semibold text-ink">Реквізити</h4>
              </template>
              <UiDescriptionList :items="details" :columns="2" size="sm" />
              <div class="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <div>
                  <p class="mb-1 text-sm text-muted">Відповідальний</p>
                  <UiInlineEdit v-model="manager" aria-label="Відповідальний менеджер" @save="onManagerSave" />
                </div>
                <div>
                  <p class="mb-1 text-sm text-muted">Телефон</p>
                  <div class="flex items-center gap-1">
                    <UiInlineEdit v-model="phone" aria-label="Телефон" />
                    <UiCopyButton :text="String(phone ?? '')" aria-label="Копіювати телефон" size="sm" />
                  </div>
                </div>
              </div>
            </UiCard>

            <UiCard>
              <UiTagInput
                v-model="tags"
                label="Мітки"
                placeholder="Додати мітку…"
                :suggestions="['опт', 'роздріб', 'HoReCa', 'кав’ярні', 'постійний', 'VIP']"
                size="sm"
              />
            </UiCard>

            <UiCard>
              <form class="space-y-3" @submit.prevent="addNote">
                <UiTextarea v-model="note" label="Нотатка" placeholder="Що важливо знати команді…" autoresize :rows="2" />
                <div class="flex justify-end">
                  <UiButton type="submit" size="sm" :disabled="!note.trim()">Додати в стрічку</UiButton>
                </div>
              </form>
            </UiCard>
          </div>

          <div class="space-y-4">
            <UiCard>
              <template #header>
                <h4 class="text-sm font-semibold text-ink">Воронка</h4>
              </template>
              <UiStepper v-model="stage" :steps="stages" click-mode="any" compact />
              <p class="mt-3 text-sm text-muted">
                Етап: <span class="font-medium text-ink">{{ stages[stage]!.label }}</span>
                <template v-if="stage < stages.length - 1"> · далі {{ stages[stage + 1]!.label.toLowerCase() }}</template>
              </p>
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

      <template #panel-deals>
        <ul class="divide-y divide-line overflow-hidden rounded-card border border-line">
          <li v-for="deal in deals" :key="deal.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover focus:outline-none focus-visible:bg-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              @click="showDeal(deal)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-ink">{{ deal.title }}</span>
                <span class="block text-xs text-muted">Термін: {{ deal.due }}</span>
              </span>
              <UiChip :tone="stageTone(deal.stage)" dot>{{ stages[deal.stage]!.label }}</UiChip>
              <span class="w-24 text-right text-sm font-semibold tabular-nums text-ink">₴{{ money.format(deal.amount) }}</span>
            </button>
          </li>
        </ul>
      </template>

      <template #panel-files>
        <div class="space-y-3">
          <UiFileUpload multiple hint="PDF, таблиці чи фото до 10 МБ; завантаження тут імітується." :max-size-mb="10" @select="addFiles" @error="toast.error($event)" />
          <ul class="divide-y divide-line rounded-card border border-line">
            <li v-for="file in files" :key="file.id" class="flex items-center gap-3 px-4 py-2.5">
              <UiCheckbox
                :model-value="selectedFiles.includes(file.id)"
                :disabled="file.uploading"
                @update:model-value="toggleFile(file.id, $event)"
              >
                <span class="sr-only">Обрати {{ file.name }}</span>
              </UiCheckbox>
              <svg class="h-5 w-5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
              </svg>
              <span class="min-w-0 flex-1 truncate text-sm text-ink">{{ file.name }}</span>
              <UiSpinner v-if="file.uploading" size="sm" tone="accent" label="Завантажується" />
              <span v-else class="text-xs tabular-nums text-muted">{{ file.size }}</span>
            </li>
          </ul>
          <UiActionBar :open="selectedFiles.length > 0" :count="selectedFiles.length" label="файли обрано" @dismiss="selectedFiles = []">
            <UiButton variant="ghost" size="sm" @click="toast.info('Демо: архів готується')">Завантажити</UiButton>
            <UiButton variant="danger" size="sm" @click="removeFiles">Видалити</UiButton>
          </UiActionBar>
        </div>
      </template>
    </UiTabs>

    <UiDrawer v-model="dealOpen" :title="openDeal?.title ?? 'Угода'" size="sm">
      <div v-if="openDeal" class="space-y-5">
        <div>
          <p class="text-sm text-muted">Сума угоди</p>
          <p class="text-3xl font-semibold tabular-nums tracking-tight text-ink">₴{{ money.format(openDeal.amount) }}</p>
        </div>
        <UiStepper v-model="openDeal.stage" :steps="stages" click-mode="any" />
        <UiDescriptionList
          size="sm"
          :items="[
            { key: 'client', term: 'Клієнт', value: 'ТОВ «Сігма Трейд»' },
            { key: 'due', term: 'Термін', value: openDeal.due },
            { key: 'owner', term: 'Відповідальний', value: String(manager ?? '—') },
          ]"
        />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="dealOpen = false">Закрити</UiButton>
        <UiButton :disabled="openDeal?.stage === 3" @click="markWon">Позначити виграною</UiButton>
      </template>
    </UiDrawer>
  </div>
</template>
