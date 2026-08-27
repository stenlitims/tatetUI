<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCard from '~/components/ui/UiCard.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiMenu from '~/components/ui/UiMenu.vue'
import UiMultiSelect, { type MultiSelectOption } from '~/components/ui/UiMultiSelect.vue'
import UiPagination from '~/components/ui/UiPagination.vue'
import UiSelect, { type SelectOption } from '~/components/ui/UiSelect.vue'
import UiTable, { type TableHeader, type TableSort } from '~/components/ui/UiTable.vue'
import UiTooltip from '~/components/ui/UiTooltip.vue'
import { useConfirm } from '~/composables/useConfirm'
import { useToast } from '~/composables/useToast'

defineSlots<Record<string, never>>()

interface PageRow extends Record<string, unknown> {
  id: number
  title: string
  views: number
  status: 'published' | 'draft' | 'scheduled'
}

const headers: TableHeader[] = [
  { value: 'title', text: 'Сторінка', sortable: true, width: 220, flex: true },
  {
    value: 'views',
    text: 'Перегляди',
    sortable: true,
    align: 'right',
    width: 120,
    defaultSortDir: 'desc',
  },
  { value: 'status', text: 'Статус', sortable: true, width: 140 },
]

const rows = ref<PageRow[]>([
  { id: 1, title: 'Головна', views: 22910, status: 'published' },
  { id: 2, title: 'Каталог', views: 1284, status: 'published' },
  { id: 3, title: 'Про нас', views: 431, status: 'draft' },
  { id: 4, title: 'Контакти', views: 87, status: 'draft' },
  { id: 5, title: 'Літня кампанія', views: 0, status: 'scheduled' },
  { id: 6, title: 'Партнерам', views: 718, status: 'published' },
  { id: 7, title: 'Вакансії', views: 204, status: 'draft' },
])

const statusOptions: MultiSelectOption[] = [
  { value: 'published', label: 'Опубліковано' },
  { value: 'draft', label: 'Чернетки' },
  { value: 'scheduled', label: 'Заплановано' },
]

const editorStatusOptions: SelectOption[] = statusOptions.map((option) => ({
  value: option.value,
  label: option.label,
}))

const filters = ref<(string | number)[]>(['published', 'draft', 'scheduled'])
const search = shallowRef('')
const page = shallowRef(1)
const pageSize = shallowRef(4)
const sort = ref<TableSort | null>({ by: 'views', dir: 'desc' })
const drawerOpen = shallowRef(false)
const editingId = shallowRef<number | null>(null)
const draftTitle = shallowRef('')
const draftStatus = shallowRef<string | number | null>('draft')
const toast = useToast()
const { confirm } = useConfirm()

const filteredRows = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('uk')
  const selected = new Set(filters.value)
  return rows.value.filter((row) => {
    const matchesStatus = selected.size === 0 || selected.has(row.status)
    const matchesSearch = !needle || row.title.toLocaleLowerCase('uk').includes(needle)
    return matchesStatus && matchesSearch
  })
})

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

function openCreate() {
  editingId.value = null
  draftTitle.value = ''
  draftStatus.value = 'draft'
  drawerOpen.value = true
}

function openEdit(row: PageRow) {
  editingId.value = row.id
  draftTitle.value = row.title
  draftStatus.value = row.status
  drawerOpen.value = true
}

function savePage() {
  const title = draftTitle.value.trim()
  if (!title) return
  const status = draftStatus.value as PageRow['status']
  if (editingId.value == null) {
    rows.value.push({ id: Date.now(), title, views: 0, status })
    toast.success(`Сторінку «${title}» створено`)
  } else {
    const row = rows.value.find((item) => item.id === editingId.value)
    if (row) Object.assign(row, { title, status })
    toast.success(`Сторінку «${title}» оновлено`)
  }
  drawerOpen.value = false
}

async function removeDrafts(closeMenu: () => void) {
  closeMenu()
  const accepted = await confirm({
    title: 'Видалити чернетки?',
    message: 'Ця демонстраційна дія прибере всі рядки зі статусом «Чернетка».',
    confirmText: 'Видалити',
    danger: true,
  })
  if (!accepted) return
  const before = rows.value.length
  rows.value = rows.value.filter((row) => row.status !== 'draft')
  toast.success(`Видалено чернеток: ${before - rows.value.length}`)
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 pb-20">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-3xl font-semibold tracking-tight text-ink">Робочий сценарій з даними</h2>
        <p class="mt-2 max-w-2xl text-muted">
          Фільтри, серверне сортування, pagination, drawer-форма, confirm і toast працюють як один потік.
        </p>
      </div>
      <UiButton @click="openCreate">Створити сторінку</UiButton>
    </div>

    <UiCard padding="none" class="mt-8 overflow-hidden">
      <template #header>
        <div class="grid gap-3 md:grid-cols-[1fr_18rem_auto] md:items-end">
          <UiInput v-model="search" label="Пошук" placeholder="Назва сторінки…" size="sm" />
          <UiMultiSelect
            v-model="filters"
            :options="statusOptions"
            label="Статуси"
            size="sm"
          />
          <UiMenu width="12rem">
            <template #trigger="{ toggle, triggerAttrs }">
              <UiButton v-bind="triggerAttrs" variant="outline" size="sm" @click="toggle">
                Масові дії
              </UiButton>
            </template>
            <template #content="{ toggle }">
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center px-3 py-2.5 text-left text-sm text-ink hover:bg-hover focus:outline-none focus-visible:bg-hover md:py-2"
                @click="toast.info('Експорт підготовлено'); toggle()"
              >
                Експортувати
              </button>
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center px-3 py-2.5 text-left text-sm text-danger hover:bg-danger-bg focus:outline-none focus-visible:bg-danger-bg md:py-2"
                @click="removeDrafts(toggle)"
              >
                Видалити чернетки
              </button>
            </template>
          </UiMenu>
        </div>
      </template>

      <UiTable
        v-model:sort="sort"
        :headers="headers"
        :items="visibleRows"
        server-sort
        mobile-cards
        row-clickable
        @row-click="openEdit"
      >
        <template #cell-views="{ item }">
          {{ (item.views as number).toLocaleString('uk') }}
        </template>
        <template #cell-status="{ item }">
          <UiChip
            :tone="item.status === 'published' ? 'success' : item.status === 'scheduled' ? 'info' : 'neutral'"
            dot
            :label="String(item.status)"
          >
            {{ item.status === 'published' ? 'опубліковано' : item.status === 'scheduled' ? 'заплановано' : 'чернетка' }}
          </UiChip>
        </template>
        <template #empty>
          <p class="px-4 py-10 text-center text-sm text-muted">За цими фільтрами сторінок немає.</p>
        </template>
      </UiTable>

      <div class="border-t border-line px-4 pb-4">
        <UiPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :total-pages="totalPages"
          :total-items="sortedRows.length"
          :page-size-options="[2, 4, 6]"
        />
      </div>
    </UiCard>

    <p class="mt-3 text-sm text-muted">
      Рядок відкриває редагування. Деталі keyboard-взаємодії пояснює
      <UiTooltip content="Enter або Space активує сфокусований рядок">
        <template #default="{ describedBy }">
          <UiButton
            :aria-describedby="describedBy"
            variant="ghost"
            size="icon-sm"
            label="Підказка про клавіатуру"
          >
            ?
          </UiButton>
        </template>
      </UiTooltip>
    </p>

    <UiDrawer v-model="drawerOpen" :title="editingId == null ? 'Нова сторінка' : 'Редагування сторінки'" size="sm">
      <form id="home-page-form" class="space-y-4" @submit.prevent="savePage">
        <UiInput v-model="draftTitle" label="Назва" required />
        <UiSelect v-model="draftStatus" :options="editorStatusOptions" label="Статус" />
      </form>
      <template #footer>
        <UiButton variant="ghost" @click="drawerOpen = false">Скасувати</UiButton>
        <UiButton type="submit" form="home-page-form" :disabled="!draftTitle.trim()">Зберегти</UiButton>
      </template>
    </UiDrawer>
  </section>
</template>
