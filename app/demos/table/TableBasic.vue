<script setup lang="ts">
import { ref } from 'vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiTable, { type TableHeader, type TableSort } from '~/components/ui/UiTable.vue'

interface Page extends Record<string, unknown> {
  id: number
  title: string
  views: number
  status: 'published' | 'draft'
}

const headers: TableHeader[] = [
  { value: 'title', text: 'Сторінка', sortable: true },
  { value: 'views', text: 'Перегляди', sortable: true, align: 'right', width: '9rem' },
  { value: 'status', text: 'Статус', width: '9rem' },
]

// «Файл 10» проти «Файл 9» — саме те, на чому наївне сортування помиляється.
const items = ref<Page[]>([
  { id: 1, title: 'Розділ 2', views: 1284, status: 'published' },
  { id: 2, title: 'Розділ 10', views: 87, status: 'draft' },
  { id: 3, title: 'Розділ 9', views: 22910, status: 'published' },
  { id: 4, title: 'Вступ', views: 431, status: 'draft' },
])

const sort = ref<TableSort | null>({ by: 'views', dir: 'desc' })
</script>

<template>
  <div class="w-full">
    <UiTable v-model:sort="sort" :headers="headers" :items="items" mobile-cards row-clickable>
      <template #cell-views="{ item }">
        {{ (item.views as number).toLocaleString('uk') }}
      </template>
      <template #cell-status="{ item }">
        <UiChip :tone="item.status === 'published' ? 'success' : 'neutral'" dot :label="String(item.status)">
          {{ item.status === 'published' ? 'опубліковано' : 'чернетка' }}
        </UiChip>
      </template>
    </UiTable>
    <p class="mt-2 text-xs text-muted">
      Сортування: {{ sort ? `${sort.by} / ${sort.dir}` : 'скинуто' }} — третій клік по заголовку скидає.
    </p>
  </div>
</template>
