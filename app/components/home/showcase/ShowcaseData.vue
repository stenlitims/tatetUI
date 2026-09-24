<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiMultiSelect, { type MultiSelectOption } from '~/components/ui/UiMultiSelect.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
import UiPagination from '~/components/ui/UiPagination.vue'
import UiSelect, { type SelectOption } from '~/components/ui/UiSelect.vue'
import UiSwitch from '~/components/ui/UiSwitch.vue'
import UiTable, { type TableHeader, type TableSort } from '~/components/ui/UiTable.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import { useConfirm } from '~/composables/useConfirm'
import { useToast } from '~/composables/useToast'

defineSlots<Record<string, never>>()

type Status = 'published' | 'draft' | 'scheduled'

interface PageRow extends Record<string, unknown> {
  id: number
  title: string
  slug: string
  author: string
  views: number
  status: Status
  updated: string
  inMenu: boolean
  summary: string
}

const headers: TableHeader[] = [
  { value: 'title', text: 'Сторінка', sortable: true, width: 240, flex: true },
  { value: 'author', text: 'Автор', width: 170 },
  { value: 'views', text: 'Перегляди', sortable: true, align: 'right', width: 120, defaultSortDir: 'desc' },
  { value: 'status', text: 'Статус', sortable: true, width: 150 },
]

const rows = ref<PageRow[]>([
  { id: 1, title: 'Головна', slug: '/', author: 'Олена Бондар', views: 22910, status: 'published', updated: '2026-09-22', inMenu: true, summary: 'Вітрина майстерні: нові колекції й бестселери.' },
  { id: 2, title: 'Каталог кераміки', slug: '/catalog', author: 'Тарас Мельник', views: 12840, status: 'published', updated: '2026-09-20', inMenu: true, summary: '' },
  { id: 3, title: 'Осіння колекція', slug: '/autumn', author: 'Олена Бондар', views: 0, status: 'scheduled', updated: '2026-09-24', inMenu: false, summary: 'Теракота, охра й шавлія — старт 1 жовтня.' },
  { id: 4, title: 'Про майстерню', slug: '/about', author: 'Ірина Коваль', views: 4310, status: 'published', updated: '2026-08-30', inMenu: true, summary: '' },
  { id: 5, title: 'Догляд за керамікою', slug: '/care', author: 'Тарас Мельник', views: 1874, status: 'draft', updated: '2026-09-18', inMenu: false, summary: '' },
  { id: 6, title: 'Доставка й оплата', slug: '/delivery', author: 'Ірина Коваль', views: 7181, status: 'published', updated: '2026-07-11', inMenu: true, summary: '' },
  { id: 7, title: 'Майстер-класи', slug: '/workshops', author: 'Олена Бондар', views: 204, status: 'draft', updated: '2026-09-12', inMenu: false, summary: '' },
  { id: 8, title: 'Оптовим клієнтам', slug: '/wholesale', author: 'Тарас Мельник', views: 918, status: 'published', updated: '2026-09-02', inMenu: false, summary: '' },
])

const STATUS: Record<Status, { label: string; tone: 'success' | 'neutral' | 'info' }> = {
  published: { label: 'Опубліковано', tone: 'success' },
  draft: { label: 'Чернетка', tone: 'neutral' },
  scheduled: { label: 'Заплановано', tone: 'info' },
}

const statusOptions: MultiSelectOption[] = (Object.keys(STATUS) as Status[]).map((value) => ({
  value,
  label: STATUS[value].label,
}))
const editorStatusOptions: SelectOption[] = statusOptions.map(({ value, label }) => ({ value, label }))

const filters = ref<(string | number)[]>(['published', 'draft', 'scheduled'])
const search = shallowRef('')
const page = shallowRef(1)
const pageSize = shallowRef(5)
const sort = ref<TableSort | null>({ by: 'views', dir: 'desc' })
const selected = ref<Array<string | number>>([])

const filteredRows = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('uk')
  const allowed = new Set(filters.value)
  return rows.value.filter((row) => {
    const matchesStatus = allowed.size === 0 || allowed.has(row.status)
    const matchesSearch =
      !needle || row.title.toLocaleLowerCase('uk').includes(needle) || row.slug.includes(needle)
    return matchesStatus && matchesSearch
  })
})

// Сортування «на сервері»: таблиця лише повідомляє, що змінилось, а порядок
// рахуємо тут — так само, як з API, що сортує сам.
const sortedRows = computed(() => {
  if (!sort.value) return filteredRows.value
  const { by, dir } = sort.value
  const factor = dir === 'asc' ? 1 : -1
  return [...filteredRows.value].sort((left, right) => {
    const a = left[by]
    const b = right[by]
    if (typeof a === 'number' && typeof b === 'number') return factor * (a - b)
    return factor * String(a ?? '').localeCompare(String(b ?? ''), 'uk', { numeric: true })
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / pageSize.value)))
const visibleRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return sortedRows.value.slice(start, start + pageSize.value)
})

watch([filters, search, pageSize], () => {
  page.value = 1
})
watch(totalPages, (total) => {
  page.value = Math.min(page.value, total)
})

const hasFilters = computed(() => !!search.value || filters.value.length !== statusOptions.length)

function resetFilters() {
  search.value = ''
  filters.value = statusOptions.map((option) => option.value)
}

const date = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' })
const formatDate = (iso: string) => date.format(new Date(`${iso}T12:00:00`))

/* ------------------------------------------------------------------ */
/*  Редагування в drawer                                               */
/* ------------------------------------------------------------------ */

const drawerOpen = shallowRef(false)
const editingId = shallowRef<number | null>(null)
// status ширший за Status: UiSelect віддає string | number | null, і вузький
// тип тут змусив би кастувати в шаблоні.
const draft = ref<{ title: string; slug: string; status: string | number | null; summary: string; inMenu: boolean }>({
  title: '',
  slug: '',
  status: 'draft',
  summary: '',
  inMenu: false,
})
const titleError = computed(() => (draft.value.title.trim() ? undefined : 'Назва обов\'язкова'))
const touched = shallowRef(false)

function openCreate() {
  editingId.value = null
  draft.value = { title: '', slug: '/', status: 'draft', summary: '', inMenu: false }
  touched.value = false
  drawerOpen.value = true
}

function openEdit(row: PageRow) {
  editingId.value = row.id
  draft.value = { title: row.title, slug: row.slug, status: row.status, summary: row.summary, inMenu: row.inMenu }
  touched.value = false
  drawerOpen.value = true
}

const toast = useToast()
const { confirm } = useConfirm()

function savePage() {
  touched.value = true
  if (titleError.value) return
  const payload = { ...draft.value, title: draft.value.title.trim(), status: (draft.value.status ?? 'draft') as Status }
  if (editingId.value == null) {
    rows.value.unshift({
      id: Date.now(),
      author: 'Ви',
      views: 0,
      updated: new Date().toISOString().slice(0, 10),
      ...payload,
    })
    toast.success(`Сторінку «${payload.title}» створено`)
  } else {
    const row = rows.value.find((item) => item.id === editingId.value)
    if (row) Object.assign(row, payload)
    toast.success(`Зміни в «${payload.title}» збережено`)
  }
  drawerOpen.value = false
}

function publishSelected(clear: () => void) {
  const ids = new Set(selected.value)
  let changed = 0
  for (const row of rows.value) {
    if (ids.has(row.id) && row.status !== 'published') {
      row.status = 'published'
      changed += 1
    }
  }
  clear()
  toast.success(changed ? `Опубліковано сторінок: ${changed}` : 'Обрані сторінки вже опубліковані')
}

async function deleteSelected(clear: () => void) {
  const count = selected.value.length
  const accepted = await confirm({
    title: `Видалити ${count} ${count === 1 ? 'сторінку' : count < 5 ? 'сторінки' : 'сторінок'}?`,
    message: 'Сторінки зникнуть із сайту одразу. Відновити їх можна лише з резервної копії.',
    confirmText: 'Видалити',
    danger: true,
  })
  if (!accepted) return
  const ids = new Set(selected.value)
  const removed = rows.value.filter((row) => ids.has(row.id))
  rows.value = rows.value.filter((row) => !ids.has(row.id))
  clear()
  toast.success(`Видалено сторінок: ${removed.length}`, {
    actions: [
      {
        label: 'Повернути',
        onClick: () => {
          rows.value = [...removed, ...rows.value]
          toast.info('Сторінки повернуто')
        },
      },
    ],
    duration: 6000,
  })
}
</script>

<template>
  <div class="space-y-4 p-4 sm:p-6">
    <UiPageHeader title="Сторінки сайту" description="Контент магазину: чернетки, заплановані й опубліковані сторінки." as="h3">
      <template #actions>
        <UiButton @click="openCreate">
          <template #leading>
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </template>
          Нова сторінка
        </UiButton>
      </template>
    </UiPageHeader>

    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
      <UiInput v-model="search" type="search" placeholder="Пошук за назвою чи адресою…" aria-label="Пошук сторінок" clearable size="sm">
        <template #leading>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </template>
      </UiInput>
      <UiMultiSelect v-model="filters" :options="statusOptions" placeholder="Статуси" size="sm" aria-label="Статуси" />
    </div>

    <div class="overflow-clip rounded-card border border-line">
      <UiTable
        v-model:sort="sort"
        v-model:selected="selected"
        :headers="headers"
        :items="visibleRows"
        key-row="id"
        selectable
        server-sort
        mobile-cards
        row-clickable
        @row-click="openEdit"
      >
        <template #selection-actions="{ clear }">
          <UiButton size="sm" variant="soft" @click="publishSelected(clear)">Опублікувати</UiButton>
          <UiButton size="sm" variant="danger" @click="deleteSelected(clear)">Видалити</UiButton>
        </template>

        <template #cell-title="{ item }">
          <div class="min-w-0">
            <p class="truncate font-medium text-ink">{{ item.title }}</p>
            <p class="truncate text-xs text-muted">{{ item.slug }} · {{ formatDate(item.updated as string) }}</p>
          </div>
        </template>

        <template #cell-author="{ item }">
          <span class="flex min-w-0 items-center gap-2">
            <UiAvatar :name="item.author as string" :size="24" :tone="item.author === 'Ви' ? 'neutral' : 'primary'" />
            <span class="truncate">{{ item.author }}</span>
          </span>
        </template>

        <template #cell-views="{ item }">
          {{ (item.views as number).toLocaleString('uk-UA') }}
        </template>

        <template #cell-status="{ item }">
          <UiChip :tone="STATUS[item.status as Status].tone" dot>{{ STATUS[item.status as Status].label }}</UiChip>
        </template>

        <template #empty>
          <UiEmptyState title="Нічого не знайшлося" description="Жодна сторінка не відповідає пошуку й фільтрам." compact>
            <template #icon>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </template>
            <UiButton v-if="hasFilters" size="sm" variant="outline" @click="resetFilters">Скинути фільтри</UiButton>
          </UiEmptyState>
        </template>
      </UiTable>

      <div class="border-t border-line px-3 py-3 sm:px-4">
        <UiPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :total-pages="totalPages"
          :total-items="sortedRows.length"
          :page-size-options="[5, 10]"
        />
      </div>
    </div>

    <UiDrawer v-model="drawerOpen" :title="editingId == null ? 'Нова сторінка' : 'Редагування сторінки'" size="sm">
      <form id="showcase-page-form" class="space-y-4" novalidate @submit.prevent="savePage">
        <UiInput v-model="draft.title" label="Назва" required :error="touched ? titleError : undefined" />
        <UiInput v-model="draft.slug" label="Адреса" hint="Починається з /, лише латиниця" />
        <UiSelect v-model="draft.status" :options="editorStatusOptions" label="Статус" />
        <UiTextarea
          v-model="draft.summary"
          label="Опис для пошуковиків"
          :max-length="160"
          show-count
          autoresize
          :rows="3"
        />
        <div class="flex items-center justify-between gap-4 rounded-card border border-line bg-subtle px-3.5 py-3">
          <div>
            <p class="text-sm font-medium text-ink">Показувати в меню</p>
            <p class="text-xs text-muted">Посилання з'явиться в шапці сайту</p>
          </div>
          <UiSwitch v-model="draft.inMenu" label="Показувати в меню" />
        </div>
      </form>
      <template #footer>
        <UiButton variant="ghost" @click="drawerOpen = false">Скасувати</UiButton>
        <UiButton type="submit" form="showcase-page-form">Зберегти</UiButton>
      </template>
    </UiDrawer>
  </div>
</template>
