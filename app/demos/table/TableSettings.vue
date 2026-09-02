<script setup lang="ts">
import { ref } from 'vue'
import UiTable, { type TableHeader } from '~/components/ui/UiTable.vue'

interface Row extends Record<string, unknown> {
  id: number
  sku: string
  name: string
  vendor: string
  price: number
  stock: number
  note: string
}

/**
 * `flex: true` рівно на одній колонці — вона забирає залишок ширини.
 * Сума фіксованих має вміщатись у контейнер.
 */
const headers: TableHeader[] = [
  { value: 'sku', text: 'SKU', width: 80, sortable: true, required: true },
  { value: 'name', text: 'Назва', width: 170, sortable: true, flex: true },
  { value: 'vendor', text: 'Постачальник', width: 120, sortable: true },
  { value: 'price', text: 'Ціна', width: 90, sortable: true, align: 'right' },
  { value: 'stock', text: 'Залишок', width: 80, sortable: true, align: 'right' },
  { value: 'note', text: 'Примітка', width: 150, clamp: 2 },
]

const items = ref<Row[]>([
  { id: 1, sku: 'AB-1', name: 'Кабель USB-C 2 м', vendor: 'Мережа Плюс', price: 249, stock: 12, note: 'Доставка з Києва протягом доби. Залишок оновлюється щогодини.' },
  { id: 2, sku: 'AB-10', name: 'Кабель USB-C 0.5 м', vendor: 'Мережа Плюс', price: 149, stock: 3, note: 'Мала партія.' },
  { id: 3, sku: 'AB-9', name: 'Перехідник HDMI', vendor: 'Технохаб', price: 599, stock: 0, note: 'Немає в наявності, очікується поповнення наступного тижня.' },
  { id: 4, sku: 'CD-2', name: 'Док-станція 7-в-1', vendor: 'Технохаб', price: 2490, stock: 5, note: '' },
  { id: 5, sku: 'CD-7', name: 'Хаб USB-C 4 порти', vendor: 'Мережа Плюс', price: 890, stock: 27, note: 'Хіт продажів сезону.' },
  { id: 6, sku: 'EF-3', name: 'Зарядний пристрій 65 Вт GaN', vendor: 'Технохаб', price: 1290, stock: 8, note: 'Компактний блок із двома USB-C.' },
])
</script>

<template>
  <div class="w-full space-y-2">
    <UiTable
      :headers="headers"
      :items="items"
      table-id="demo-catalog"
      :settings-version="2"
      max-height="18rem"
      sticky-header
      sticky-column
      mobile-cards
    >
      <template #cell-price="{ item }">{{ (item.price as number).toLocaleString('uk') }} ₴</template>
    </UiTable>

    <p class="text-xs text-muted">
      Потягніть межу заголовка, щоб змінити ширину; подвійний клік скидає.
      Кнопка над таблицею — видимість, порядок і щільність. Усе
      зберігається й переживає перезавантаження. Прокрутіть таблицю вбік:
      колонка SKU лишається на місці, решта їде під неї.
    </p>
  </div>
</template>