<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiTreeTable, { type TreeTableHeader } from '~/components/ui/UiTreeTable.vue'

interface Category extends Record<string, unknown> {
  id: number
  name: string
  alias: string
  items: number
  createdAt: string
  updatedAt: string
  children?: Category[]
}

const GROUPS = [
  'Техніка та електроніка',
  'Товари для дому',
  'Одяг і взуття',
  'Дитячі товари',
  'Спорт і відпочинок',
  'Автотовари',
  'Краса та здоров’я',
  'Зоотовари',
  'Сад і город',
  'Книги та канцтовари',
  'Будматеріали',
  'Продукти',
]

const KINDS = ['Аксесуари', 'Комплектуючі', 'Витратні матеріали', 'Набори']
const FACETS = ['преміум', 'базові', 'уцінка']

/*
 * Дані детерміновані: (i * 7919) % n замість Math.random() і жодного
 * new Date(). Демо прередериться, і випадкові числа дали б різні
 * значення на сервері й у браузері — гідратація з розбіжностями.
 */
function stamp(seed: number): string {
  const day = 1 + ((seed * 7919) % 28)
  const month = 1 + ((seed * 13) % 12)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.2026`
}

let nextId = 1

function makeNode(name: string, depth: number, children?: Category[]): Category {
  const id = nextId++
  return {
    id,
    name,
    alias: `${name.slice(0, 12).toLowerCase().replace(/[^a-zа-яіїєґ]+/gi, '-')}-${id}`,
    items: children?.length ? 0 : 3 + ((id * 7919) % 240),
    createdAt: stamp(id),
    updatedAt: stamp(id + 17),
    children,
  }
}

const catalog: Category[] = GROUPS.map((group) =>
  makeNode(
    group,
    0,
    KINDS.map((kind) =>
      makeNode(
        `${kind}`,
        1,
        FACETS.map((facet) =>
          makeNode(
            `${kind}, ${facet}`,
            2,
            [makeNode(`${facet} — вітрина`, 3), makeNode(`${facet} — склад`, 3)],
          ),
        ),
      ),
    ),
  ),
)

// Два верхні рівні відкриті одразу: так на екрані більше двохсот рядків,
// поріг віртуалізації (100) перейдено, і демо показує саме її.
const openByDefault: number[] = []
for (const group of catalog) {
  openByDefault.push(group.id)
  for (const kind of group.children ?? []) openByDefault.push(kind.id)
}

const headers: TreeTableHeader[] = [
  { value: 'name', text: 'Структура', width: 320, sortable: true },
  { value: 'alias', text: 'Alias', width: 200, sortable: true },
  { value: 'items', text: 'Товарів', width: 100, align: 'right', sortable: true },
  { value: 'createdAt', text: 'Створено', width: 120, sortable: true },
  { value: 'updatedAt', text: 'Оновлено', width: 120, sortable: true, flex: true },
]

const expanded = ref<(string | number)[]>(openByDefault)
const selected = ref<(string | number)[]>([])
const sort = ref<{ by: string; dir: 'asc' | 'desc' } | null>(null)
/*
 * Тип посилання описаний структурно, а не через InstanceType: для
 * генеричних SFC (`generic="T"`) `typeof Component` — це функція, а не
 * конструктор, і InstanceType до неї не застосовується.
 */
const tree = ref<{
  expandAll: () => void
  collapseAll: () => void
  scrollToKey: (key: string | number) => boolean
} | null>(null)
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UiButton size="sm" variant="outline" @click="tree?.expandAll()">Розгорнути все</UiButton>
      <UiButton size="sm" variant="outline" @click="tree?.collapseAll()">Згорнути все</UiButton>
      <UiButton size="sm" variant="ghost" @click="tree?.scrollToKey(catalog.at(-1)!.id)">
        До останньої групи
      </UiButton>
      <p class="ml-auto text-xs text-muted">
        {{ catalog.length }} груп · 492 вузли · видимих рядків: {{ expanded.length ? '204+' : '12' }}
      </p>
    </div>

    <UiTreeTable
      ref="tree"
      v-model:expanded="expanded"
      v-model:selected="selected"
      v-model:sort="sort"
      :headers="headers"
      :items="catalog"
      table-id="demo-catalog"
      selectable
      sticky-tree-column
      mobile-cards
      :card-height="150"
      max-height="24rem"
      aria-label="Каталог категорій"
    >
      <template #icon="{ hasChildren, expanded: open }">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            v-if="hasChildren"
            :d="
              open
                ? 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v1H6l-3 8z'
                : 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z'
            "
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <path
            v-else
            d="M6 3h8l4 4v14H6zM14 3v4h4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </template>

      <template #cell-items="{ item }">
        <span class="tabular-nums" :class="(item.items as number) ? 'text-ink' : 'text-muted'">
          {{ (item.items as number) || '—' }}
        </span>
      </template>

      <template #selection-actions="{ clear }">
        <UiButton size="sm" variant="ghost" @click="clear">Скинути</UiButton>
      </template>
    </UiTreeTable>
  </div>
</template>
