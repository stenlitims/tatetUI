<script setup lang="ts">
import { shallowRef } from 'vue'
import UiNavigationMenu, { type NavigationMenuItem } from '~/components/ui/UiNavigationMenu.vue'
import UiRadioGroup from '~/components/ui/UiRadioGroup.vue'

const openItem = shallowRef<string | null>(null)
const size = shallowRef<'sm' | 'md' | 'lg'>('md')
const variant = shallowRef<'plain' | 'underline' | 'pill'>('plain')
const selected = shallowRef('Огляд')

const items: NavigationMenuItem[] = [
  { id: 'overview', label: 'Огляд', href: '#overview', current: true },
  {
    id: 'products',
    label: 'Продукти',
    children: [
      { id: 'analytics', label: 'Аналітика', description: 'Звіти й продуктові метрики', href: '#analytics' },
      { id: 'automation', label: 'Автоматизація', description: 'Тригери, дії та сценарії', href: '#automation' },
      { id: 'labs', label: 'Labs', description: 'Експериментальні можливості', disabled: true },
    ],
  },
  { id: 'pricing', label: 'Ціни', href: '#pricing' },
]
</script>

<template>
  <div class="flex flex-col items-start gap-6">
    <div class="flex flex-wrap gap-6">
      <UiRadioGroup
        v-model="size"
        name="navigation-menu-size"
        orientation="horizontal"
        :options="[
          { value: 'sm', label: 'sm' },
          { value: 'md', label: 'md' },
          { value: 'lg', label: 'lg' },
        ]"
      />
      <UiRadioGroup
        v-model="variant"
        name="navigation-menu-variant"
        orientation="horizontal"
        :options="[
          { value: 'plain', label: 'plain' },
          { value: 'underline', label: 'underline' },
          { value: 'pill', label: 'pill' },
        ]"
      />
    </div>

    <div class="w-full rounded-card border border-line bg-card px-4 py-3">
      <UiNavigationMenu
        v-model="openItem"
        :size="size"
        :variant="variant"
        :items="items"
        @select="selected = $event.label"
      />
    </div>

    <p class="text-sm text-muted">
      size: <span class="font-medium text-ink">{{ size }}</span> ·
      variant: <span class="font-medium text-ink">{{ variant }}</span> ·
      Останній вибір: {{ selected }}
    </p>
  </div>
</template>