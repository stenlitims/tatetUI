<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiTable, { type TableHeader } from '~/components/ui/UiTable.vue'
import { useToast } from '~/composables/useToast'

interface Deal extends Record<string, unknown> {
  id: number
  client: string
  status: 'active' | 'won' | 'lost'
  amount: number
  locked?: boolean
}

const toast = useToast()

const headers: TableHeader[] = [
  { value: 'client', text: 'Клієнт', width: 220, flex: true, sortable: true },
  { value: 'status', text: 'Статус', width: 130 },
  { value: 'amount', text: 'Сума', width: 130, align: 'right', sortable: true },
]

const items = ref<Deal[]>([
  { id: 1, client: 'ТОВ «Сігма Трейд»', status: 'active', amount: 420000 },
  { id: 2, client: 'ФОП Коваленко О. П.', status: 'won', amount: 86500 },
  { id: 3, client: 'ПрАТ «Дніпро-Логістик»', status: 'active', amount: 1240000 },
  { id: 4, client: 'ТОВ «Аграрій Плюс»', status: 'lost', amount: 54000, locked: true },
  { id: 5, client: 'ТОВ «Медтехніка»', status: 'active', amount: 315000 },
])

const selected = ref<Array<string | number>>([])

const TONES = { active: 'info', won: 'success', lost: 'danger' } as const
const LABELS = { active: 'В роботі', won: 'Виграно', lost: 'Втрачено' } as const

function formatMoney(value: number) {
  return `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₴`
}

function bulkArchive() {
  toast.success(`Заархівовано записів: ${selected.value.length}`)
  selected.value = []
}
</script>

<template>
  <div class="w-full">
    <UiTable
      v-model:selected="selected"
      :headers="headers"
      :items="items"
      key-row="id"
      selectable
      :selectable-row="(item) => !item.locked"
      mobile-cards
    >
      <template #selection-actions="{ clear }">
        <UiButton size="sm" variant="soft" @click="bulkArchive">Заархівувати</UiButton>
        <UiButton size="sm" variant="ghost" @click="clear">Скасувати</UiButton>
      </template>

      <template #cell-status="{ item }">
        <UiChip :tone="TONES[item.status as keyof typeof TONES]" dot>
          {{ LABELS[item.status as keyof typeof LABELS] }}
        </UiChip>
      </template>

      <template #cell-amount="{ item }">
        {{ formatMoney(item.amount as number) }}
      </template>
    </UiTable>

    <p class="mt-3 text-sm text-muted">
      Shift+клік виділяє діапазон. Втрачену угоду обрати не можна —
      <code>selectableRow</code> її виключає.
    </p>
  </div>
</template>
