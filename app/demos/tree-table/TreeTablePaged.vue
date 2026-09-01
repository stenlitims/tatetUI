<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UiPagination from '~/components/ui/UiPagination.vue'
import UiTreeTable, { type TreeTableHeader } from '~/components/ui/UiTreeTable.vue'

interface Section extends Record<string, unknown> {
  id: number
  name: string
  owner: string
  updatedAt: string
  children?: Section[]
}

const OWNERS = ['Олена', 'Тарас', 'Ірина', 'Богдан', 'Марта']

// Детерміновано: (i * 7919) % n замість Math.random() і без new Date() —
// інакше прередер і клієнт показали б різні значення.
function stamp(seed: number) {
  const day = 1 + ((seed * 7919) % 28)
  const month = 1 + ((seed * 13) % 12)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.2026`
}

const sections: Section[] = Array.from({ length: 40 }, (_, r) => {
  const id = r + 1
  return {
    id,
    name: `Розділ ${id}`,
    owner: OWNERS[id % OWNERS.length]!,
    updatedAt: stamp(id),
    children: Array.from({ length: 3 }, (_, c) => {
      const childId = id * 100 + c + 1
      return {
        id: childId,
        name: `Розділ ${id} — підрозділ ${c + 1}`,
        owner: OWNERS[childId % OWNERS.length]!,
        updatedAt: stamp(childId),
        children: Array.from({ length: 2 }, (_, g) => {
          const leafId = childId * 10 + g + 1
          return {
            id: leafId,
            name: `Розділ ${id}.${c + 1} — сторінка ${g + 1}`,
            owner: OWNERS[leafId % OWNERS.length]!,
            updatedAt: stamp(leafId),
          }
        }),
      }
    }),
  }
})

const headers: TreeTableHeader[] = [
  { value: 'name', text: 'Структура', width: 300, sortable: true },
  { value: 'owner', text: 'Відповідальний', width: 150, sortable: true },
  { value: 'updatedAt', text: 'Оновлено', width: 120, sortable: true, flex: true },
]

const page = ref(1)
const pageSize = ref(10)
const expanded = ref<(string | number)[]>([1])

/*
 * Сторінками йдуть КОРЕНІ, а не рядки.
 *
 * Різати плоский список видимих рядків не можна: дитина опинилась би на
 * наступній сторінці без свого батька, тобто без єдиного, що пояснює її
 * місце. Тому сторінка — це N коренів РАЗОМ з їхніми піддеревами, і
 * загальна кількість рахується теж по коренях.
 */
const totalPages = computed(() => Math.max(1, Math.ceil(sections.length / pageSize.value)))

const pageRoots = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return sections.slice(start, start + pageSize.value)
})

// Зміна розміру сторінки майже завжди вибиває поточну сторінку за межі
// діапазону — повертаємось на першу, як і будь-який список.
watch(pageSize, () => {
  page.value = 1
})
</script>

<template>
  <div class="w-full min-w-0 space-y-3">
    <UiTreeTable
      v-model:expanded="expanded"
      :headers="headers"
      :items="pageRoots"
      max-height="20rem"
      aria-label="Розділи посторінково"
    />

    <UiPagination
      v-model:page="page"
      v-model:page-size="pageSize"
      :total-pages="totalPages"
      :total-items="sections.length"
      :page-size-options="[5, 10, 20]"
    />
  </div>
</template>
