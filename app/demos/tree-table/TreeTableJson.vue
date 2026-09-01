<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import UiFileUpload from '~/components/ui/UiFileUpload.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import UiTreeTable, { type TreeTableHeader } from '~/components/ui/UiTreeTable.vue'
import { labelClass } from '~/utils/uiFieldStyles'
import { filterTree } from '~/utils/treeTable'

/** Формат вивантаження дерева категорій: вузол + плоский `data`. */
interface ShopNode extends Record<string, unknown> {
  id: number
  parent: number
  name: string
  children?: ShopNode[]
  data?: {
    active?: number
    categoryTitle?: string | null
    categoryId?: number
    childsCount?: number
    itemsCount?: number
    itemsXmlCount?: number
  }
}

function node(
  id: number,
  parent: number,
  name: string,
  data: Partial<NonNullable<ShopNode['data']>>,
  children: ShopNode[] = [],
): ShopNode {
  return {
    id,
    parent,
    name,
    children,
    data: { active: 1, categoryTitle: null, categoryId: 0, childsCount: children.length, itemsCount: 0, itemsXmlCount: 0, ...data },
  }
}

/** Зразок у тому ж форматі, що й вивантаження — щоб сторінка не була порожньою. */
const SAMPLE: ShopNode[] = [
  node(1265685, 0, 'it off', { active: 0 }, [
    node(4171161, 1265685, 'Захист екрану хлам', { active: 0, itemsCount: 26 }),
    node(4233695, 1265685, 'Технічні та загальні товари', { itemsCount: 1 }),
  ]),
  node(6054982, 0, 'Відеоспостереження', {
    categoryTitle: 'IP-камери',
    categoryId: 156790,
    itemsCount: 14,
    itemsXmlCount: 14,
  }),
  node(4825198, 0, 'Катя', {}, [
    node(4825199, 4825198, 'Дитяча термобілизна', {
      categoryTitle: 'Дитяча термобілизна',
      categoryId: 1658277,
      itemsCount: 13,
      itemsXmlCount: 13,
    }),
  ]),
  node(4396136, 0, 'Ігрові маніпулятори й аксесуари до консолей', {
    categoryTitle: 'Ігрові маніпулятори й аксесуари до консолей',
    categoryId: 80173,
    itemsCount: 8,
    itemsXmlCount: 8,
  }),
]

const items = ref<ShopNode[]>(SAMPLE)
const source = ref('зразок')
const error = ref('')
const pasted = ref('')
// Гілки зразка відкриті одразу: інакше демо показує лише корені, і те,
// заради чого воно існує — вкладеність, — доводиться шукати кліком.
const expanded = ref<(string | number)[]>([1265685, 4825198])

/* ---------------------------------------------------------------- */
/*  Пошук і фільтри                                                 */
/* ---------------------------------------------------------------- */

const query = ref('')
const status = ref<string | number>('all')
const onlyLinked = ref(false)

const STATUS_OPTIONS = [
  { value: 'all', label: 'Усі' },
  { value: 'active', label: 'Активні' },
  { value: 'off', label: 'Вимкнені' },
]

/** Предикат по ОДНОМУ вузлу. Предків збігу підставляє filterTree. */
function matchesNode(item: ShopNode): boolean {
  if (status.value === 'active' && !item.data?.active) return false
  if (status.value === 'off' && item.data?.active) return false
  if (onlyLinked.value && !item.data?.categoryId) return false

  const needle = query.value.trim().toLowerCase()
  if (!needle) return true
  const title = item.data?.categoryTitle ?? ''
  return item.name.toLowerCase().includes(needle) || title.toLowerCase().includes(needle)
}

const filtering = computed(
  () => query.value.trim() !== '' || status.value !== 'all' || onlyLinked.value,
)

const view = computed(() => {
  // Без активного фільтра дерево віддається ЯК Є — жодних копій вузлів,
  // тож і зайвих перемальовувань немає.
  if (!filtering.value) return { items: items.value, matched: [], expand: [] }
  return filterTree(items.value, {
    getId: (item) => item.id,
    getChildren: (item) => item.children,
    withChildren: (item, children) => ({ ...item, children }),
    matches: matchesNode,
  })
})

/*
 * Під фільтром гілки розгортаються самі: знайдений вузол лежить на
 * третьому рівні, і без цього результат виглядав би як порожній список
 * кількох тек. Розгортання користувача при цьому не губиться — воно
 * відкладається і повертається, коли фільтр знімають.
 */
let savedExpanded: (string | number)[] | null = null

watch([filtering, () => view.value.expand], ([on, expand]) => {
  if (on) {
    if (savedExpanded === null) savedExpanded = [...expanded.value]
    expanded.value = expand as (string | number)[]
  } else if (savedExpanded !== null) {
    expanded.value = savedExpanded
    savedExpanded = null
  }
})

/**
 * Українська множина: 1 вузол, 2 вузли, 5 вузлів.
 *
 * Голе `N вузлів` читається як помилка перекладу рівно там, де число
 * найчастіше й дорівнює одиниці — у результаті пошуку.
 */
function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function resetFilters() {
  query.value = ''
  status.value = 'all'
  onlyLinked.value = false
}
const tree = ref<{ expandAll: () => void; collapseAll: () => void } | null>(null)

/**
 * Поля лежать не на вузлі, а у вкладеному `data`. Саме для цього в
 * компонента є `getValue`: перекладати дані під колонки не треба.
 *
 * Ключі колонок навмисно БЕЗ крапок: `cell-data.active` у шаблоні
 * розібрався б як слот `cell-data` з модифікатором `active`.
 */
function getValue(item: ShopNode, key: string): unknown {
  if (key === 'name') return item.name
  return item.data?.[key as keyof NonNullable<ShopNode['data']>]
}

const headers: TreeTableHeader[] = [
  { value: 'name', text: 'Структура', width: 300, sortable: true },
  { value: 'categoryTitle', text: 'Категорія', width: 190, sortable: true },
  { value: 'itemsCount', text: 'Товарів', width: 90, align: 'right', sortable: true },
  { value: 'itemsXmlCount', text: 'У XML', width: 80, align: 'right', sortable: true },
  { value: 'active', text: 'Статус', width: 110, sortable: true, flex: true },
]

const stats = computed(() => {
  let count = 0
  let depth = 0
  let leaves = 0
  const walk = (nodes: ShopNode[], level: number) => {
    for (const item of nodes) {
      count += 1
      depth = Math.max(depth, level)
      const kids = item.children ?? []
      if (kids.length) walk(kids, level + 1)
      else leaves += 1
    }
  }
  walk(view.value.items, 1)
  return { count, depth, leaves }
})

/*
 * Дублікати id — не косметика: рядки ключуються саме id, тож два вузли з
 * одним id ламають і :key, і виділення, і фокус. У вивантаженні назви
 * повторюються часто, id — ніколи, тож перевіряти варто саме їх.
 */
const duplicateIds = computed(() => {
  const seen = new Set<number>()
  const dupes = new Set<number>()
  const walk = (nodes: ShopNode[]) => {
    for (const item of nodes) {
      if (seen.has(item.id)) dupes.add(item.id)
      else seen.add(item.id)
      walk(item.children ?? [])
    }
  }
  walk(items.value)
  return [...dupes]
})

function applyRaw(raw: string, from: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    error.value = `Некоректний JSON — ${(cause as Error).message}`
    return
  }
  if (!Array.isArray(parsed)) {
    error.value = 'На верхньому рівні очікується масив вузлів.'
    return
  }
  const broken = parsed.find(
    (item) => !item || typeof item !== 'object' || (item as ShopNode).id === undefined,
  )
  if (broken) {
    error.value = 'У кожного вузла має бути поле id.'
    return
  }
  error.value = ''
  items.value = parsed as ShopNode[]
  source.value = from
  expanded.value = []
  savedExpanded = null
  resetFilters()
}

function onSelect(files: File[]) {
  const file = files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onerror = () => {
    error.value = 'Не вдалося прочитати файл.'
  }
  reader.onload = () => applyRaw(String(reader.result ?? ''), file.name)
  reader.readAsText(file)
}
</script>

<template>
  <div class="w-full min-w-0 space-y-3">
    <UiFileUpload
      accept=".json,application/json"
      label="Перетягніть JSON сюди"
      hint="Масив вузлів: id, parent, name, children[], data{}. Файл нікуди не надсилається — читається у браузері."
      @select="onSelect"
      @error="error = $event"
    />

    <details class="rounded-card border border-line bg-card px-3 py-2">
      <summary class="cursor-pointer text-sm text-muted">Або вставити JSON текстом</summary>
      <div class="mt-2 space-y-2">
        <UiTextarea v-model="pasted" :rows="4" size="sm" placeholder="[{ &quot;id&quot;: 1, &quot;parent&quot;: 0, &quot;name&quot;: &quot;…&quot;, &quot;children&quot;: [] }]" />
        <UiButton size="sm" :disabled="!pasted.trim()" @click="applyRaw(pasted, 'вставлений текст')">
          Показати
        </UiButton>
      </div>
    </details>

    <UiAlert v-if="error" tone="danger" title="Не вдалося прочитати дані">{{ error }}</UiAlert>

    <UiAlert v-if="duplicateIds.length" tone="warning" title="Повторювані id">
      {{ duplicateIds.length }} вузлів мають неунікальний id (напр. {{ duplicateIds[0] }}). Рядки
      ключуються за id, тож виділення й фокус працюватимуть неправильно.
    </UiAlert>

    <!--
      Панель фільтрів — НАД таблицею, поза контейнером прокрутки: усередині
      нього вона поїхала б горизонтально разом із колонками й зникла б
      рівно тоді, коли до неї треба повернутись.

      Три речі тримають рядок рівним, і кожна з них — не косметика:

      1. Розміри підібрані так, щоб КОНТРОЛИ збігалися по висоті. Шкали
         не паралельні: у перемикача до висоти сегмента додається ще
         `p-1` доріжки, тож `sm` дає 26.25 + 7.5 = 33.75px. Це рівно
         висота поля `md` і кнопки `md` — саме ця трійка й стоїть тут.
      2. Лейбл має або кожна колонка, або жодна. Коли він був лише в
         пошуку, саме пошук і виглядав з'їхалим; підпис перемикача взято
         з того самого `labelClass`, що й у поля.
      3. Кнопка скидання не з'являється й не зникає, а вимикається:
         `v-if` смикав ширину рядка щоразу, коли фільтр ставав активним.
    -->
    <div class="flex flex-wrap items-end gap-3 rounded-card border border-line bg-card p-3">
      <div class="min-w-56 flex-1">
        <UiInput
          v-model="query"
          type="search"
          size="md"
          label="Пошук"
          placeholder="Назва або категорія"
        />
      </div>

      <div>
        <span :class="labelClass">Статус</span>
        <UiToggleGroup v-model="status" :options="STATUS_OPTIONS" size="sm" aria-label="Статус" />
      </div>

      <!-- Обгортка тієї ж висоти, що й поле: інакше прапорець без
           підпису зверху висне вище за решту рядка. -->
      <div class="flex h-12 items-center md:h-9">
        <UiCheckbox v-model="onlyLinked">
          <span class="text-sm whitespace-nowrap">Лише прив’язані</span>
        </UiCheckbox>
      </div>

      <UiButton
        size="md"
        variant="outline"
        class="ml-auto"
        :disabled="!filtering"
        @click="resetFilters"
      >
        Скинути
      </UiButton>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UiButton size="sm" variant="outline" @click="tree?.expandAll()">Розгорнути все</UiButton>
      <UiButton size="sm" variant="outline" @click="tree?.collapseAll()">Згорнути все</UiButton>
      <p class="ml-auto text-xs text-muted">
        <span v-if="filtering">Знайдено {{ view.matched.length }} · показано</span>
        <span v-else>Джерело — {{ source }} ·</span>
        {{ stats.count }} {{ plural(stats.count, 'вузол', 'вузли', 'вузлів') }} · глибина
        {{ stats.depth }} · {{ stats.leaves }}
        {{ plural(stats.leaves, 'листок', 'листки', 'листків') }}
      </p>
    </div>

    <UiTreeTable
      ref="tree"
      v-model:expanded="expanded"
      :headers="headers"
      :items="view.items"
      :get-value="getValue"
      table-id="demo-json"
      max-height="22rem"
      :empty-text="filtering ? 'Нічого не знайдено' : 'Оберіть файл, щоб побачити дерево'"
      aria-label="Дерево з файлу"
    >
      <template #cell-categoryTitle="{ item }">
        <span :class="item.data?.categoryTitle ? 'text-ink' : 'text-muted'">
          {{ item.data?.categoryTitle ?? 'не прив’язано' }}
        </span>
      </template>

      <template #cell-active="{ item }">
        <UiChip :tone="item.data?.active ? 'success' : 'neutral'" size="sm">
          {{ item.data?.active ? 'Активна' : 'Вимкнена' }}
        </UiChip>
      </template>
    </UiTreeTable>
  </div>
</template>
