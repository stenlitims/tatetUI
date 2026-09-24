<script setup lang="ts">
import { shallowRef } from 'vue'
import UiBreadcrumb from '~/components/ui/UiBreadcrumb.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
import UiTabs from '~/components/ui/UiTabs.vue'

const tab = shallowRef('overview')
</script>

<template>
  <div class="w-full rounded-card border border-line bg-card p-5">
    <UiPageHeader
      title="ТОВ «Сігма Трейд»"
      description="Оптовий покупець кераміки. Менеджер — Олена Бондар."
      as="h2"
    >
      <template #breadcrumb>
        <UiBreadcrumb :items="[{ label: 'CRM' }, { label: 'Клієнти' }, { label: 'Сігма Трейд' }]" />
      </template>
      <template #meta>
        <UiChip tone="success" dot>Активний</UiChip>
        <span>Клієнт з березня 2024</span>
        <span>12 угод</span>
      </template>
      <template #actions>
        <UiButton variant="outline">Написати</UiButton>
        <UiButton>Нова угода</UiButton>
      </template>

      <UiTabs
        v-model="tab"
        :tabs="[
          { id: 'overview', label: 'Огляд' },
          { id: 'deals', label: 'Угоди' },
          { id: 'files', label: 'Файли' },
        ]"
      />
    </UiPageHeader>
  </div>
</template>
