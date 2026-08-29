<script setup lang="ts">
import UiChip from '~/components/ui/UiChip.vue'
import UiDescriptionList, { type DescriptionItem } from '~/components/ui/UiDescriptionList.vue'

const items: DescriptionItem[] = [
  { key: 'company', term: 'Компанія', value: 'ТОВ «Сігма Трейд»' },
  { key: 'status', term: 'Статус' },
  { key: 'manager', term: 'Менеджер', value: 'Олена Ковальчук' },
  { key: 'amount', term: 'Сума угоди', value: '₴420 000' },
  { key: 'created', term: 'Створено', value: '12 серпня 2026' },
  { key: 'source', term: 'Джерело', value: null },
  { key: 'address', term: 'Адреса', value: 'м. Львів, вул. Городоцька 174, офіс 12', wide: true },
]
</script>

<template>
  <div class="w-full max-w-2xl rounded-card border border-line bg-card p-5">
    <UiDescriptionList :items="items" divided>
      <template #value-status>
        <UiChip tone="success" dot>Активний</UiChip>
      </template>
    </UiDescriptionList>
  </div>
</template>
