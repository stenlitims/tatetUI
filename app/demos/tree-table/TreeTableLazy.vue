<script setup lang="ts">
import { ref } from 'vue'
import UiTreeTable, { type TreeTableHeader } from '~/components/ui/UiTreeTable.vue'

interface Folder extends Record<string, unknown> {
  id: number
  name: string
  alias: string
  childsCount: number
  items: number
  children?: Folder[]
}

/*
 * Ліниве дерево: у вузла є childsCount, але немає children. Саме за цим
 * компонент і відрізняє «діти ще їдуть» від «гілка порожня»: undefined —
 * перше, [] — друге.
 */
function folder(id: number, name: string, childsCount: number): Folder {
  return {
    id,
    name,
    alias: `folder-${id}`,
    childsCount,
    items: childsCount ? 0 : 5 + ((id * 7919) % 90),
  }
}

const roots = ref<Folder[]>([
  folder(1, 'Довідка', 3),
  folder(2, 'Формати реклами', 2),
  folder(3, 'Аналітика', 0),
])

const loadingIds = ref<(string | number)[]>([])
const expanded = ref<(string | number)[]>([])

function findNode(nodes: Folder[], id: string | number): Folder | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const hit = node.children ? findNode(node.children, id) : null
    if (hit) return hit
  }
  return null
}

function onExpand({ id, loaded }: { id: string | number; loaded: boolean }) {
  // loaded каже, що діти вже приїжджали: другий запит не потрібен.
  if (loaded) return
  loadingIds.value = [...loadingIds.value, id]

  // Затримка імітує мережу. Значення дітей детерміновані — від id батька.
  setTimeout(() => {
    const parent = findNode(roots.value, id)
    if (parent) {
      parent.children = Array.from({ length: parent.childsCount }, (_, i) => {
        const childId = Number(id) * 100 + i + 1
        return folder(childId, `${parent.name} — розділ ${i + 1}`, i === 0 ? 2 : 0)
      })
      roots.value = [...roots.value]
    }
    loadingIds.value = loadingIds.value.filter((value) => value !== id)
  }, 600)
}

const headers: TreeTableHeader[] = [
  { value: 'name', text: 'Структура', width: 280, sortable: true },
  { value: 'alias', text: 'Alias', width: 140 },
  { value: 'items', text: 'Товарів', width: 100, align: 'right', flex: true },
]
</script>

<template>
  <UiTreeTable
    v-model:expanded="expanded"
    :headers="headers"
    :items="roots"
    :loading-ids="loadingIds"
    :has-children="(item) => (item.childsCount as number) > 0"
    max-height="18rem"
    aria-label="Ліниве дерево розділів"
    @expand="onExpand"
  />
</template>
