<script setup lang="ts">
import UiDescriptionList, { type DescriptionItem } from '~/components/ui/UiDescriptionList.vue'

const items: DescriptionItem[] = [
  { key: 'plan', term: 'Тариф', value: 'Команда' },
  { key: 'seats', term: 'Місць', value: '12 із 25' },
  { key: 'renew', term: 'Наступне списання', value: '1 вересня' },
  { key: 'invoice', term: 'Рахунок', value: '№ 2026-0841' },
]
</script>

<template>
  <div class="w-full max-w-sm rounded-card border border-line bg-card p-5">
    <h3 class="mb-3 text-sm font-semibold text-ink">Підписка</h3>
    <!-- inline лишається inline і на телефоні: саме заради цього вигляду
         пару «назва / значення» не роблять таблицею. -->
    <UiDescriptionList :items="items" layout="inline" :columns="1" size="sm" divided />
  </div>
</template>
