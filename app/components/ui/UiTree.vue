<script setup lang="ts">
import { computed, nextTick, onBeforeUpdate, ref, watch } from 'vue'

export interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
  disabled?: boolean
}

interface FlatRow {
  node: TreeNode
  depth: number
  expanded: boolean
  selected: boolean
  hasChildren: boolean
  /** Батько по ланцюжку видимих рядків — для ← (вгору по ієрархії). */
  parentId: string | null
}

const props = withDefaults(
  defineProps<{
    /** Дерево. Джерело правди — масив коренів. */
    items: TreeNode[]
    /** Вибраний вузол. Використовуйте через `v-model`. */
    modelValue?: string | null
    /** Відкриті вузли. Використовуйте через `v-model:expanded`. */
    expanded?: string[]
    /** Клік по рядку з дітьми тогглить гілку. */
    expandOnClick?: boolean
    /** Клік по рядку обирає вузол. */
    selectable?: boolean
  }>(),
  { modelValue: null, expanded: () => [], expandOnClick: true, selectable: true },
)

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
  'update:expanded': [ids: string[]]
  /** Клік або Enter по рядку. */
  itemClick: [{ node: TreeNode; depth: number }]
}>()

defineSlots<{
  /** Власний рендер рядка. */
  item?: (props: { node: TreeNode; depth: number; expanded: boolean; selected: boolean; hasChildren: boolean }) => unknown
  /** Власна іконка тоггла замість шеврона. */
  toggle?: (props: { expanded: boolean; hasChildren: boolean }) => unknown
}>()

/*
 * Розгорнуті вузли: некерований стан із синхронізацією від props.expanded
 * (порівняння по вмісту, не по посиланню).
 */
const expandedIds = ref<Set<string>>(new Set(props.expanded))

watch(
  () => props.expanded,
  (ids) => {
    const next = new Set(ids)
    if (next.size !== expandedIds.value.size || [...next].some((id) => !expandedIds.value.has(id))) {
      expandedIds.value = next
    }
  },
)

function emitExpanded() {
  emit('update:expanded', [...expandedIds.value])
}

function toggle(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) {
    next.delete(id)
    activeId.value = id
  } else next.add(id)
  expandedIds.value = next
  emitExpanded()
}

/**
 * Плоский зріз видимих рядків: рекурсивний обхід, де гілки без
 * розгортання не заходять у дітей. Один v-for у шаблоні.
 */
const flatRows = computed<FlatRow[]>(() => {
  const rows: FlatRow[] = []
  const walk = (nodes: TreeNode[], depth: number, parentId: string | null) => {
    for (const node of nodes) {
      const expanded = expandedIds.value.has(node.id)
      const hasChildren = !!node.children?.length
      rows.push({
        node,
        depth,
        expanded,
        selected: node.id === props.modelValue,
        hasChildren,
        parentId,
      })
      if (hasChildren && expanded) walk(node.children!, depth + 1, node.id)
    }
  }
  walk(props.items, 0, null)
  return rows
})

/* ---------------------------------------------------------------- */
/*  Клавіатура: roving tabindex по видимих рядах                     */
/* ---------------------------------------------------------------- */

const rowEls = ref<(HTMLElement | null)[]>([])
const activeId = ref<string | null>(props.modelValue ?? flatRows.value[0]?.node.id ?? null)

onBeforeUpdate(() => {
  rowEls.value = []
})

watch(flatRows, (rows) => {
  if (rows.some((row) => row.node.id === activeId.value)) return
  activeId.value = rows[0]?.node.id ?? null
})

function focusRow(index: number) {
  const row = flatRows.value[index]
  if (!row) return
  activeId.value = row.node.id
  void nextTick(() => rowEls.value[index]?.focus())
}

function onRowKeydown(event: KeyboardEvent, row: FlatRow, index: number) {
  const last = flatRows.value.length - 1
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (index < last) focusRow(index + 1)
      return
    case 'ArrowUp':
      event.preventDefault()
      if (index > 0) focusRow(index - 1)
      return
    case 'ArrowRight':
      event.preventDefault()
      if (row.hasChildren && !row.expanded) {
        toggle(row.node.id)
      } else if (index < last) {
        focusRow(index + 1)
      }
      return
    case 'ArrowLeft':
      event.preventDefault()
      if (row.hasChildren && row.expanded) {
        toggle(row.node.id)
      } else if (row.parentId) {
        const parentIndex = flatRows.value.findIndex((r) => r.node.id === row.parentId)
        if (parentIndex >= 0) focusRow(parentIndex)
      }
      return
    case 'Home':
      event.preventDefault()
      focusRow(0)
      return
    case 'End':
      event.preventDefault()
      focusRow(last)
      return
    case 'Enter':
    case ' ':
      event.preventDefault()
      onRowActivate(row)
  }
}

function onRowClick(row: FlatRow) {
  activeId.value = row.node.id
  onRowActivate(row)
}

function onRowActivate(row: FlatRow) {
  if (row.node.disabled) return
  if (props.selectable) {
    emit('update:modelValue', row.node.id)
  }
  emit('itemClick', { node: row.node, depth: row.depth })
  if (props.expandOnClick && row.hasChildren) toggle(row.node.id)
}
</script>

<template>
  <div role="tree" class="rounded-card border border-line bg-card py-1">
    <div
      v-for="(row, index) in flatRows"
      :key="row.node.id"
      :ref="(el) => (rowEls[index] = el as HTMLElement)"
      role="treeitem"
      :tabindex="row.node.id === activeId ? 0 : -1"
      :aria-level="row.depth + 1"
      :aria-expanded="row.hasChildren ? row.expanded : undefined"
      :aria-selected="selectable ? row.selected : undefined"
      :aria-disabled="row.node.disabled || undefined"
      class="flex h-11 cursor-pointer select-none items-center gap-1.5 pr-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:h-9"
      :class="[
        row.selected ? 'bg-primary-50 font-medium text-accent' : 'text-ink hover:bg-hover',
        row.node.disabled ? 'pointer-events-none opacity-50' : '',
      ]"
      :style="{ paddingLeft: `${row.depth * 1.25 + 0.5}rem` }"
      @click="onRowClick(row)"
      @keydown="onRowKeydown($event, row, index)"
    >
      <!-- Тоггл-кнопка: окремий клік не провокує вибір рядка. -->
      <span
        v-if="row.hasChildren"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink"
        aria-hidden="true"
        @click.stop="toggle(row.node.id)"
      >
        <slot name="toggle" :expanded="row.expanded" :has-children="row.hasChildren">
          <svg
            class="h-3.5 w-3.5 transition-transform"
            :class="row.expanded ? 'rotate-90' : ''"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </slot>
      </span>
      <span v-else class="w-5 shrink-0" aria-hidden="true" />

      <slot name="item" :node="row.node" :depth="row.depth" :expanded="row.expanded" :selected="row.selected" :has-children="row.hasChildren">
        <span class="truncate text-sm">{{ row.node.label }}</span>
      </slot>
    </div>
  </div>
</template>
