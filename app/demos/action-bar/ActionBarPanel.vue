<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import UiActionBar from '~/components/ui/UiActionBar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import { useToast } from '~/composables/useToast'

interface Order {
  id: number
  title: string
  meta: string
}

const toast = useToast()
const titleId = useId()

const orders = ref<Order[]>([
  { id: 1042, title: '№ 1042 · Ваза «Теракота»', meta: 'Олена К. · 1 240 ₴' },
  { id: 1043, title: '№ 1043 · Чашка «Вершки» ×4', meta: 'Максим Д. · 1 520 ₴' },
  { id: 1044, title: '№ 1044 · Миска «Шавлія»', meta: 'Ірина П. · 690 ₴' },
  { id: 1045, title: '№ 1045 · Тарілка «Ряба» ×6', meta: 'Андрій С. · 2 280 ₴' },
  { id: 1046, title: '№ 1046 · Ваза «Кобальт»', meta: 'Софія Л. · 1 180 ₴' },
  { id: 1047, title: '№ 1047 · Набір «Сніданок»', meta: 'Тарас М. · 3 450 ₴' },
  { id: 1048, title: '№ 1048 · Глечик «Льон»', meta: 'Наталія Г. · 980 ₴' },
])

// Два замовлення обрано одразу — щоб розкладку панелі було видно без кліку.
const selected = ref<number[]>([1043, 1044])
const allChecked = computed(() => selected.value.length === orders.value.length)

// «2 замовлення обрано», «5 замовлень обрано»: підпис стоїть після числа.
const pluralRules = new Intl.PluralRules('uk')
const label = computed(() =>
  pluralRules.select(selected.value.length) === 'many' ? 'замовлень обрано' : 'замовлення обрано',
)

function toggle(id: number, value: boolean) {
  selected.value = value ? [...selected.value, id] : selected.value.filter((item) => item !== id)
}

function toggleAll(value: boolean) {
  selected.value = value ? orders.value.map((order) => order.id) : []
}

function done(message: string) {
  toast.success(`${message}: ${selected.value.length}`)
  selected.value = []
}

function reject() {
  const count = selected.value.length
  orders.value = orders.value.filter((order) => !selected.value.includes(order.id))
  selected.value = []
  toast.success(`Відхилено замовлень: ${count}`)
}
</script>

<template>
  <!-- Бічна панель на ~420px — як дравер чи колонка CRM. Розкладку
       ActionBar обирає її ширина, а не ширина екрана: навіть на широкому
       моніторі лічильник і хрестик тут стоять угорі, а п'ять дій — під
       ними. На телефоні ряд дій гортається вбік. -->
  <section
    class="flex h-100 w-full max-w-md flex-col overflow-clip rounded-card border border-line bg-card shadow-card"
    :aria-labelledby="titleId"
  >
    <header class="flex items-center gap-3 border-b border-line px-4 py-3">
      <UiCheckbox
        :model-value="allChecked"
        :indeterminate="selected.length > 0 && !allChecked"
        @update:model-value="toggleAll"
      >
        <span class="sr-only">Обрати всі замовлення</span>
      </UiCheckbox>
      <!-- m-0: демо живе всередині .docs-prose, і відступи прозового h3
           (2em згори) зсували б назву нижче за чекбокс і лічильник. -->
      <h3 :id="titleId" class="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-ink">Нові замовлення</h3>
      <span class="text-sm tabular-nums text-muted">{{ orders.length }}</span>
    </header>

    <!-- Область прокрутки — найближчий прокручуваний предок панелі, тож
         sticky прилипає до низу саме бічної панелі, а не вікна. -->
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">
      <ul class="divide-y divide-line">
        <li v-for="order in orders" :key="order.id" class="px-1 py-2.5">
          <UiCheckbox
            :model-value="selected.includes(order.id)"
            :label="order.title"
            :description="order.meta"
            @update:model-value="toggle(order.id, $event)"
          />
        </li>
      </ul>

      <UiActionBar :open="selected.length > 0" :count="selected.length" :label="label" @dismiss="selected = []">
        <UiButton size="sm" @click="done('Підтверджено замовлень')">Підтвердити</UiButton>
        <UiButton variant="ghost" size="sm" @click="toast.info('Накладні готуються до друку')">Накладні</UiButton>
        <UiButton variant="ghost" size="sm" @click="done('Передано в роботу')">Змінити статус</UiButton>
        <UiButton variant="ghost" size="sm" @click="toast.info('Файл CSV готується')">Експорт</UiButton>
        <UiButton variant="danger" size="sm" @click="reject">Відхилити</UiButton>
      </UiActionBar>
    </div>
  </section>
</template>
